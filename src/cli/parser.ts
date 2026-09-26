import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ControllerInfo,
  RouteMethodInfo,
  ParamInfo,
  ModelSchemaInfo,
  PropertySchemaInfo,
  ParsedProject,
  HttpMethod,
  ApiSecurityRequirement,
  ApiParamInfo,
  ApiQueryInfo,
  ApiHeaderInfo,
  ApiBodyInfo,
  ApiResponseInfo,
  RedirectInfo,
} from '../types/index.js';

export class AstParser {
  private program: ts.Program | null = null;
  private checker: ts.TypeChecker | null = null;

  constructor(private tsConfigPath?: string) {
    if (tsConfigPath && fs.existsSync(tsConfigPath)) {
      const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsConfigPath)
      );
      this.program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
      this.checker = this.program.getTypeChecker();
    }
  }

  public parseFiles(filePaths: string[]): ParsedProject {
    const controllers: ControllerInfo[] = [];
    const models: ModelSchemaInfo[] = [];

    for (const filePath of filePaths) {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) continue;

      const sourceText = fs.readFileSync(resolvedPath, 'utf8');
      const sourceFile =
        this.program?.getSourceFile(resolvedPath) ||
        ts.createSourceFile(resolvedPath, sourceText, ts.ScriptTarget.Latest, true);

      this.visitNode(sourceFile, sourceFile, resolvedPath, controllers, models);
    }

    return { controllers, models };
  }

  private visitNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    filePath: string,
    controllers: ControllerInfo[],
    models: ModelSchemaInfo[]
  ) {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const controllerMeta = this.extractControllerDecorator(node);

      if (controllerMeta) {
        const methods = this.extractRouteMethods(node, sourceFile);
        const tags = this.extractClassTags(node);
        const security = this.extractClassSecurity(node);
        const middlewares = this.extractClassMiddlewares(node, sourceFile);
        const exclude = this.extractClassExclude(node);
        const extraModels = this.extractClassExtraModels(node);

        controllers.push({
          className,
          filePath,
          basePath: controllerMeta.basePath,
          tags,
          methods,
          security: security.length > 0 ? security : undefined,
          middlewares: middlewares.length > 0 ? middlewares : undefined,
          exclude,
          extraModels: extraModels.length > 0 ? extraModels : undefined,
        });
      }

      const modelMeta = this.extractModelSchema(node);
      if (modelMeta) {
        models.push(modelMeta);
      }
    }

    ts.forEachChild(node, (child) => this.visitNode(child, sourceFile, filePath, controllers, models));
  }

  private getDecorators(node: ts.Node): ts.Decorator[] {
    if (ts.canHaveDecorators(node)) {
      return (ts.getDecorators(node) || []) as ts.Decorator[];
    }
    // Fallback for older ts compiler nodes
    return ((node as any).decorators || []) as ts.Decorator[];
  }

  private extractControllerDecorator(node: ts.ClassDeclaration): { basePath: string } | null {
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && expr.text === 'Controller') {
          const arg = d.expression.arguments[0];
          let basePath = '';
          if (arg && ts.isStringLiteral(arg)) {
            basePath = arg.text;
          }
          if (!basePath.startsWith('/')) basePath = `/${basePath}`;
          return { basePath: basePath === '/' ? '' : basePath };
        }
      }
    }
    return null;
  }

  private extractClassTags(node: ts.ClassDeclaration): string[] {
    const tags: string[] = [];
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && expr.text === 'ApiTags') {
          for (const arg of d.expression.arguments) {
            if (ts.isStringLiteral(arg)) {
              tags.push(arg.text);
            }
          }
        }
      }
    }
    return tags;
  }

  private extractClassSecurity(node: ts.ClassDeclaration): ApiSecurityRequirement[] {
    const security: ApiSecurityRequirement[] = [];
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      const parsed = this.parseSecurityDecorator(d);
      if (parsed) {
        security.push(parsed);
      }
    }
    return security;
  }

  private extractClassMiddlewares(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): string[] {
    const middlewares: string[] = [];
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && (expr.text === 'Use' || expr.text === 'UseMiddleware')) {
          for (const arg of d.expression.arguments) {
            middlewares.push(arg.getText(sourceFile));
          }
        }
      }
    }
    return middlewares;
  }

  private extractClassExclude(node: ts.ClassDeclaration): boolean {
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && expr.text === 'ApiExcludeController') {
          const arg = d.expression.arguments[0];
          if (arg && arg.kind === ts.SyntaxKind.FalseKeyword) {
            return false;
          }
          return true;
        }
      }
    }
    return false;
  }

  private extractClassExtraModels(node: ts.ClassDeclaration): string[] {
    const models: string[] = [];
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && expr.text === 'ApiExtraModels') {
          for (const arg of d.expression.arguments) {
            if (ts.isIdentifier(arg)) {
              models.push(arg.text);
            }
          }
        }
      }
    }
    return models;
  }

  private extractRouteMethods(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile
  ): RouteMethodInfo[] {
    const methods: RouteMethodInfo[] = [];

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        const methodName = member.name.getText(sourceFile);
        const routeMeta = this.extractMethodRouteDecorator(member);

        if (routeMeta) {
          const params = this.extractMethodParameters(member, sourceFile);
          const openApiMeta = this.extractMethodOpenApi(member, sourceFile);
          const flowMeta = this.extractMethodFlow(member, sourceFile);
          const isAsync =
            member.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;

          let returnType: string | undefined;
          if (member.type) {
            returnType = member.type.getText(sourceFile);
          }

          const defaultStatus =
            flowMeta.httpCode ??
            openApiMeta.statusCode ??
            (routeMeta.httpMethod === 'post' ? 201 : 200);

          methods.push({
            methodName,
            httpMethod: routeMeta.httpMethod,
            path: routeMeta.path,
            isAsync,
            params,
            returnType,
            summary: openApiMeta.summary,
            description: openApiMeta.description,
            tags: openApiMeta.tags,
            statusCode: defaultStatus,
            deprecated: openApiMeta.deprecated,
            middlewares: flowMeta.middlewares.length > 0 ? flowMeta.middlewares : undefined,
            httpCode: flowMeta.httpCode,
            redirect: flowMeta.redirect,
            security: openApiMeta.security.length > 0 ? openApiMeta.security : undefined,
            consumes: openApiMeta.consumes.length > 0 ? openApiMeta.consumes : undefined,
            produces: openApiMeta.produces.length > 0 ? openApiMeta.produces : undefined,
            apiParams: openApiMeta.apiParams.length > 0 ? openApiMeta.apiParams : undefined,
            apiQueries: openApiMeta.apiQueries.length > 0 ? openApiMeta.apiQueries : undefined,
            apiHeaders: openApiMeta.apiHeaders.length > 0 ? openApiMeta.apiHeaders : undefined,
            apiBody: openApiMeta.apiBody,
            responses: openApiMeta.responses.length > 0 ? openApiMeta.responses : undefined,
            exclude: openApiMeta.exclude,
          });
        }
      }
    }

    return methods;
  }

  private extractMethodRouteDecorator(
    node: ts.MethodDeclaration
  ): { httpMethod: HttpMethod; path: string } | null {
    const httpVerbs: Record<string, HttpMethod> = {
      Get: 'get',
      Post: 'post',
      Put: 'put',
      Delete: 'delete',
      Patch: 'patch',
      Options: 'options',
      Head: 'head',
      All: 'all',
    };

    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && httpVerbs[expr.text]) {
          const httpMethod = httpVerbs[expr.text];
          let routePath = '/';
          const arg = d.expression.arguments[0];
          if (arg && ts.isStringLiteral(arg)) {
            routePath = arg.text;
          }
          if (!routePath.startsWith('/')) routePath = `/${routePath}`;
          return { httpMethod, path: routePath };
        }
      }
    }
    return null;
  }

  private extractMethodParameters(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile
  ): ParamInfo[] {
    const params: ParamInfo[] = [];

    node.parameters.forEach((param, index) => {
      const paramName = param.name.getText(sourceFile);
      const paramType = param.type ? param.type.getText(sourceFile) : 'any';
      const required = !param.questionToken;

      const decorators = this.getDecorators(param);
      let matched = false;

      for (const d of decorators) {
        if (ts.isCallExpression(d.expression)) {
          const expr = d.expression.expression;
          if (ts.isIdentifier(expr)) {
            const dec = expr.text;
            let argName: string | undefined;
            const firstArg = d.expression.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              argName = firstArg.text;
            }

            if (dec === 'Param') {
              params.push({
                source: 'param',
                name: argName || paramName,
                index,
                paramName,
                type: paramType,
                required,
              });
              matched = true;
              break;
            } else if (dec === 'Query') {
              params.push({
                source: 'query',
                name: argName || paramName,
                index,
                paramName,
                type: paramType,
                required,
              });
              matched = true;
              break;
            } else if (dec === 'Body') {
              params.push({
                source: 'body',
                index,
                paramName,
                type: paramType,
                required,
              });
              matched = true;
              break;
            } else if (dec === 'Header') {
              params.push({
                source: 'header',
                name: (argName || paramName).toLowerCase(),
                index,
                paramName,
                type: paramType,
                required,
              });
              matched = true;
              break;
            } else if (dec === 'Ctx') {
              params.push({
                source: 'context',
                index,
                paramName,
                type: 'Context',
                required: true,
              });
              matched = true;
              break;
            } else if (dec === 'Req' || dec === 'Request') {
              params.push({
                source: 'req',
                index,
                paramName,
                type: 'Request',
                required: true,
              });
              matched = true;
              break;
            } else if (dec === 'Res' || dec === 'Response') {
              params.push({
                source: 'res',
                index,
                paramName,
                type: 'Response',
                required: true,
              });
              matched = true;
              break;
            } else if (dec === 'Cookie') {
              params.push({
                source: 'cookie',
                name: argName || paramName,
                index,
                paramName,
                type: paramType,
                required,
              });
              matched = true;
              break;
            } else if (dec === 'Queries') {
              params.push({
                source: 'queries',
                index,
                paramName,
                type: paramType,
                required: false,
              });
              matched = true;
              break;
            } else if (dec === 'Headers') {
              params.push({
                source: 'headers',
                index,
                paramName,
                type: paramType,
                required: false,
              });
              matched = true;
              break;
            } else if (dec === 'Params') {
              params.push({
                source: 'params',
                index,
                paramName,
                type: paramType,
                required: false,
              });
              matched = true;
              break;
            }
          }
        }
      }

      if (!matched) {
        // Fallback parameter inferral
        if (paramName === 'c' || paramName === 'ctx') {
          params.push({
            source: 'context',
            index,
            paramName,
            type: 'Context',
            required: true,
          });
        }
      }
    });

    return params;
  }

  private extractMethodFlow(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile
  ): { middlewares: string[]; httpCode?: number; redirect?: RedirectInfo } {
    const middlewares: string[] = [];
    let httpCode: number | undefined;
    let redirect: RedirectInfo | undefined;

    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr)) {
          if (expr.text === 'Use' || expr.text === 'UseMiddleware') {
            for (const arg of d.expression.arguments) {
              middlewares.push(arg.getText(sourceFile));
            }
          } else if (expr.text === 'HttpCode') {
            const arg = d.expression.arguments[0];
            if (arg && ts.isNumericLiteral(arg)) {
              httpCode = parseInt(arg.text, 10);
            }
          } else if (expr.text === 'Redirect') {
            const urlArg = d.expression.arguments[0];
            const statusArg = d.expression.arguments[1];
            if (urlArg && ts.isStringLiteral(urlArg)) {
              const status =
                statusArg && ts.isNumericLiteral(statusArg)
                  ? parseInt(statusArg.text, 10)
                  : 302;
              redirect = { url: urlArg.text, status };
            }
          }
        }
      }
    }

    return { middlewares, httpCode, redirect };
  }

  private extractMethodOpenApi(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile
  ): {
    summary?: string;
    description?: string;
    tags?: string[];
    statusCode?: number;
    deprecated?: boolean;
    security: ApiSecurityRequirement[];
    consumes: string[];
    produces: string[];
    apiParams: ApiParamInfo[];
    apiQueries: ApiQueryInfo[];
    apiHeaders: ApiHeaderInfo[];
    apiBody?: ApiBodyInfo;
    responses: ApiResponseInfo[];
    exclude?: boolean;
  } {
    let summary: string | undefined;
    let description: string | undefined;
    let tags: string[] | undefined;
    let statusCode: number | undefined;
    let deprecated: boolean | undefined;
    const security: ApiSecurityRequirement[] = [];
    const consumes: string[] = [];
    const produces: string[] = [];
    const apiParams: ApiParamInfo[] = [];
    const apiQueries: ApiQueryInfo[] = [];
    const apiHeaders: ApiHeaderInfo[] = [];
    let apiBody: ApiBodyInfo | undefined;
    const responses: ApiResponseInfo[] = [];
    let exclude: boolean | undefined;

    const responseShortcuts: Record<string, number> = {
      ApiOkResponse: 200,
      ApiCreatedResponse: 201,
      ApiAcceptedResponse: 202,
      ApiNoContentResponse: 204,
      ApiBadRequestResponse: 400,
      ApiUnauthorizedResponse: 401,
      ApiForbiddenResponse: 403,
      ApiNotFoundResponse: 404,
      ApiConflictResponse: 409,
      ApiInternalServerErrorResponse: 500,
    };

    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      const sec = this.parseSecurityDecorator(d);
      if (sec) {
        security.push(sec);
      }

      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr)) {
          const dec = expr.text;

          if (dec === 'ApiOperation') {
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  if (prop.name.text === 'summary' && ts.isStringLiteral(prop.initializer)) {
                    summary = prop.initializer.text;
                  } else if (prop.name.text === 'description' && ts.isStringLiteral(prop.initializer)) {
                    description = prop.initializer.text;
                  } else if (
                    prop.name.text === 'deprecated' &&
                    prop.initializer.kind === ts.SyntaxKind.TrueKeyword
                  ) {
                    deprecated = true;
                  }
                }
              }
            }
          } else if (dec === 'ApiResponse') {
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              let respStatus = 200;
              let respDesc: string | undefined;
              for (const prop of arg.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  if (prop.name.text === 'status' && ts.isNumericLiteral(prop.initializer)) {
                    respStatus = parseInt(prop.initializer.text, 10);
                  } else if (prop.name.text === 'description' && ts.isStringLiteral(prop.initializer)) {
                    respDesc = prop.initializer.text;
                  }
                }
              }
              responses.push({ status: respStatus, description: respDesc });
              if (!statusCode) statusCode = respStatus;
            }
          } else if (responseShortcuts[dec] !== undefined) {
            const status = responseShortcuts[dec];
            let respDesc: string | undefined;
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (
                  ts.isPropertyAssignment(prop) &&
                  ts.isIdentifier(prop.name) &&
                  prop.name.text === 'description' &&
                  ts.isStringLiteral(prop.initializer)
                ) {
                  respDesc = prop.initializer.text;
                }
              }
            }
            responses.push({ status, description: respDesc });
            if (!statusCode) statusCode = status;
          } else if (dec === 'ApiTags') {
            tags = tags || [];
            for (const arg of d.expression.arguments) {
              if (ts.isStringLiteral(arg)) {
                tags.push(arg.text);
              }
            }
          } else if (dec === 'ApiConsumes') {
            for (const arg of d.expression.arguments) {
              if (ts.isStringLiteral(arg)) {
                consumes.push(arg.text);
              }
            }
          } else if (dec === 'ApiProduces') {
            for (const arg of d.expression.arguments) {
              if (ts.isStringLiteral(arg)) {
                produces.push(arg.text);
              }
            }
          } else if (dec === 'ApiParam') {
            const info = this.parseParamOrQueryDoc(d.expression.arguments[0]);
            if (info) apiParams.push(info);
          } else if (dec === 'ApiQuery') {
            const info = this.parseParamOrQueryDoc(d.expression.arguments[0]);
            if (info) apiQueries.push(info);
          } else if (dec === 'ApiHeader') {
            const info = this.parseParamOrQueryDoc(d.expression.arguments[0]);
            if (info) apiHeaders.push(info);
          } else if (dec === 'ApiBody') {
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              let bodyDesc: string | undefined;
              let bodyReq = true;
              let mediaType: string | undefined;
              for (const p of arg.properties) {
                if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                  if (p.name.text === 'description' && ts.isStringLiteral(p.initializer)) {
                    bodyDesc = p.initializer.text;
                  } else if (p.name.text === 'required') {
                    bodyReq = p.initializer.kind !== ts.SyntaxKind.FalseKeyword;
                  } else if (p.name.text === 'mediaType' && ts.isStringLiteral(p.initializer)) {
                    mediaType = p.initializer.text;
                  }
                }
              }
              apiBody = { description: bodyDesc, required: bodyReq, mediaType };
            }
          } else if (dec === 'ApiExcludeEndpoint') {
            const arg = d.expression.arguments[0];
            exclude = !(arg && arg.kind === ts.SyntaxKind.FalseKeyword);
          }
        }
      }
    }

    return {
      summary,
      description,
      tags,
      statusCode,
      deprecated,
      security,
      consumes,
      produces,
      apiParams,
      apiQueries,
      apiHeaders,
      apiBody,
      responses,
      exclude,
    };
  }

  private parseParamOrQueryDoc(argNode?: ts.Expression): ApiParamInfo | null {
    if (!argNode || !ts.isObjectLiteralExpression(argNode)) return null;
    let name = '';
    let description: string | undefined;
    let required: boolean | undefined;
    let example: any;
    let type: string | undefined;

    for (const p of argNode.properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
        if (p.name.text === 'name' && ts.isStringLiteral(p.initializer)) {
          name = p.initializer.text;
        } else if (p.name.text === 'description' && ts.isStringLiteral(p.initializer)) {
          description = p.initializer.text;
        } else if (p.name.text === 'required') {
          required = p.initializer.kind !== ts.SyntaxKind.FalseKeyword;
        } else if (p.name.text === 'example' && ts.isStringLiteral(p.initializer)) {
          example = p.initializer.text;
        } else if (p.name.text === 'type' && ts.isStringLiteral(p.initializer)) {
          type = p.initializer.text;
        }
      }
    }

    return name ? { name, description, required, example, type } : null;
  }

  private parseSecurityDecorator(d: ts.Decorator): ApiSecurityRequirement | null {
    if (!ts.isCallExpression(d.expression)) return null;
    const expr = d.expression.expression;
    if (!ts.isIdentifier(expr)) return null;
    const dec = expr.text;

    if (dec === 'ApiBearerAuth') {
      let schemeName = 'bearer';
      const arg = d.expression.arguments[0];
      if (arg && ts.isStringLiteral(arg)) schemeName = arg.text;
      return { [schemeName]: [] };
    } else if (dec === 'ApiSecurity') {
      const nameArg = d.expression.arguments[0];
      let name = 'default';
      if (nameArg && ts.isStringLiteral(nameArg)) name = nameArg.text;
      const scopes: string[] = [];
      const scopesArg = d.expression.arguments[1];
      if (scopesArg && ts.isArrayLiteralExpression(scopesArg)) {
        for (const el of scopesArg.elements) {
          if (ts.isStringLiteral(el)) scopes.push(el.text);
        }
      }
      return { [name]: scopes };
    } else if (dec === 'ApiBasicAuth') {
      let name = 'basic';
      const arg = d.expression.arguments[0];
      if (arg && ts.isStringLiteral(arg)) name = arg.text;
      return { [name]: [] };
    } else if (dec === 'ApiKeyAuth') {
      let name = 'api-key';
      const arg = d.expression.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if (
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === 'name' &&
            ts.isStringLiteral(p.initializer)
          ) {
            name = p.initializer.text;
          }
        }
      }
      return { [name]: [] };
    }

    return null;
  }

  private extractModelSchema(node: ts.ClassDeclaration): ModelSchemaInfo | null {
    const properties: PropertySchemaInfo[] = [];

    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member) && member.name) {
        const propName = member.name.getText();
        const decorators = this.getDecorators(member);

        for (const d of decorators) {
          if (ts.isCallExpression(d.expression)) {
            const expr = d.expression.expression;
            if (ts.isIdentifier(expr)) {
              if (expr.text === 'ApiProperty') {
                let propType = 'string';
                if (member.type) {
                  propType = member.type.getText();
                }
                const required = !member.questionToken;

                let desc: string | undefined;
                let example: any;
                let isArray = false;
                const enumValues: (string | number)[] = [];

                const arg = d.expression.arguments[0];
                if (arg && ts.isObjectLiteralExpression(arg)) {
                  for (const p of arg.properties) {
                    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                      if (p.name.text === 'description' && ts.isStringLiteral(p.initializer)) {
                        desc = p.initializer.text;
                      } else if (p.name.text === 'example' && ts.isStringLiteral(p.initializer)) {
                        example = p.initializer.text;
                      } else if (
                        p.name.text === 'isArray' &&
                        p.initializer.kind === ts.SyntaxKind.TrueKeyword
                      ) {
                        isArray = true;
                      } else if (p.name.text === 'enum' && ts.isArrayLiteralExpression(p.initializer)) {
                        for (const el of p.initializer.elements) {
                          if (ts.isStringLiteral(el)) enumValues.push(el.text);
                          else if (ts.isNumericLiteral(el)) enumValues.push(parseFloat(el.text));
                        }
                      }
                    }
                  }
                }

                properties.push({
                  name: propName,
                  type: propType,
                  required,
                  description: desc,
                  example,
                  enum: enumValues.length > 0 ? enumValues : undefined,
                });
              } else if (expr.text === 'ApiHideProperty') {
                properties.push({
                  name: propName,
                  type: 'any',
                  required: false,
                  hide: true,
                });
              }
            }
          }
        }
      }
    }

    if (properties.length > 0 && node.name) {
      return {
        className: node.name.text,
        properties: properties.filter((p) => !p.hide),
      };
    }

    return null;
  }
}
