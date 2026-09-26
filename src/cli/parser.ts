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
      const sourceFile = this.program?.getSourceFile(resolvedPath) ||
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

        controllers.push({
          className,
          filePath,
          basePath: controllerMeta.basePath,
          tags,
          methods,
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
          const isAsync = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;

          let returnType: string | undefined;
          if (member.type) {
            returnType = member.type.getText(sourceFile);
          }

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
            statusCode: openApiMeta.statusCode ?? (routeMeta.httpMethod === 'post' ? 201 : 200),
            deprecated: openApiMeta.deprecated,
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
            const decoratorName = expr.text;
            let argName: string | undefined;
            const firstArg = d.expression.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              argName = firstArg.text;
            }

            if (decoratorName === 'Param') {
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
            } else if (decoratorName === 'Query') {
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
            } else if (decoratorName === 'Body') {
              params.push({
                source: 'body',
                index,
                paramName,
                type: paramType,
                required,
              });
              matched = true;
              break;
            } else if (decoratorName === 'Header') {
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
            } else if (decoratorName === 'Ctx') {
              params.push({
                source: 'context',
                index,
                paramName,
                type: 'Context',
                required: true,
              });
              matched = true;
              break;
            }
          }
        }
      }

      if (!matched) {
        // Default: treat as context if named c or ctx, else param
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

  private extractMethodOpenApi(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile
  ): { summary?: string; description?: string; tags?: string[]; statusCode?: number; deprecated?: boolean } {
    let summary: string | undefined;
    let description: string | undefined;
    let tags: string[] | undefined;
    let statusCode: number | undefined;
    let deprecated: boolean | undefined;

    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr)) {
          if (expr.text === 'ApiOperation') {
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  if (prop.name.text === 'summary' && ts.isStringLiteral(prop.initializer)) {
                    summary = prop.initializer.text;
                  } else if (prop.name.text === 'description' && ts.isStringLiteral(prop.initializer)) {
                    description = prop.initializer.text;
                  } else if (prop.name.text === 'deprecated' && prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                    deprecated = true;
                  }
                }
              }
            }
          } else if (expr.text === 'ApiResponse') {
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  if (prop.name.text === 'status' && ts.isNumericLiteral(prop.initializer)) {
                    statusCode = parseInt(prop.initializer.text, 10);
                  }
                }
              }
            }
          } else if (expr.text === 'ApiTags') {
            tags = tags || [];
            for (const arg of d.expression.arguments) {
              if (ts.isStringLiteral(arg)) {
                tags.push(arg.text);
              }
            }
          }
        }
      }
    }

    return { summary, description, tags, statusCode, deprecated };
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
            if (ts.isIdentifier(expr) && expr.text === 'ApiProperty') {
              let propType = 'string';
              if (member.type) {
                propType = member.type.getText();
              }
              const required = !member.questionToken;

              let desc: string | undefined;
              let example: any;

              const arg = d.expression.arguments[0];
              if (arg && ts.isObjectLiteralExpression(arg)) {
                for (const p of arg.properties) {
                  if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                    if (p.name.text === 'description' && ts.isStringLiteral(p.initializer)) {
                      desc = p.initializer.text;
                    } else if (p.name.text === 'example' && ts.isStringLiteral(p.initializer)) {
                      example = p.initializer.text;
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
              });
            }
          }
        }
      }
    }

    if (properties.length > 0 && node.name) {
      return {
        className: node.name.text,
        properties,
      };
    }

    return null;
  }
}
