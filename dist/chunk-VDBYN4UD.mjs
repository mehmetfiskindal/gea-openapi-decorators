// src/cli/parser.ts
import ts from "typescript";
import fs from "fs";
import path from "path";
var AstParser = class {
  constructor(tsConfigPath) {
    this.tsConfigPath = tsConfigPath;
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
  tsConfigPath;
  program = null;
  checker = null;
  parseFiles(filePaths) {
    const controllers = [];
    const models = [];
    for (const filePath of filePaths) {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) continue;
      const sourceText = fs.readFileSync(resolvedPath, "utf8");
      const sourceFile = this.program?.getSourceFile(resolvedPath) || ts.createSourceFile(resolvedPath, sourceText, ts.ScriptTarget.Latest, true);
      this.visitNode(sourceFile, sourceFile, resolvedPath, controllers, models);
    }
    return { controllers, models };
  }
  visitNode(node, sourceFile, filePath, controllers, models) {
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
          methods
        });
      }
      const modelMeta = this.extractModelSchema(node);
      if (modelMeta) {
        models.push(modelMeta);
      }
    }
    ts.forEachChild(node, (child) => this.visitNode(child, sourceFile, filePath, controllers, models));
  }
  getDecorators(node) {
    if (ts.canHaveDecorators(node)) {
      return ts.getDecorators(node) || [];
    }
    return node.decorators || [];
  }
  extractControllerDecorator(node) {
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && expr.text === "Controller") {
          const arg = d.expression.arguments[0];
          let basePath = "";
          if (arg && ts.isStringLiteral(arg)) {
            basePath = arg.text;
          }
          if (!basePath.startsWith("/")) basePath = `/${basePath}`;
          return { basePath: basePath === "/" ? "" : basePath };
        }
      }
    }
    return null;
  }
  extractClassTags(node) {
    const tags = [];
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && expr.text === "ApiTags") {
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
  extractRouteMethods(node, sourceFile) {
    const methods = [];
    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        const methodName = member.name.getText(sourceFile);
        const routeMeta = this.extractMethodRouteDecorator(member);
        if (routeMeta) {
          const params = this.extractMethodParameters(member, sourceFile);
          const openApiMeta = this.extractMethodOpenApi(member, sourceFile);
          const isAsync = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
          let returnType;
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
            statusCode: openApiMeta.statusCode ?? (routeMeta.httpMethod === "post" ? 201 : 200),
            deprecated: openApiMeta.deprecated
          });
        }
      }
    }
    return methods;
  }
  extractMethodRouteDecorator(node) {
    const httpVerbs = {
      Get: "get",
      Post: "post",
      Put: "put",
      Delete: "delete",
      Patch: "patch"
    };
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr) && httpVerbs[expr.text]) {
          const httpMethod = httpVerbs[expr.text];
          let routePath = "/";
          const arg = d.expression.arguments[0];
          if (arg && ts.isStringLiteral(arg)) {
            routePath = arg.text;
          }
          if (!routePath.startsWith("/")) routePath = `/${routePath}`;
          return { httpMethod, path: routePath };
        }
      }
    }
    return null;
  }
  extractMethodParameters(node, sourceFile) {
    const params = [];
    node.parameters.forEach((param, index) => {
      const paramName = param.name.getText(sourceFile);
      const paramType = param.type ? param.type.getText(sourceFile) : "any";
      const required = !param.questionToken;
      const decorators = this.getDecorators(param);
      let matched = false;
      for (const d of decorators) {
        if (ts.isCallExpression(d.expression)) {
          const expr = d.expression.expression;
          if (ts.isIdentifier(expr)) {
            const decoratorName = expr.text;
            let argName;
            const firstArg = d.expression.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              argName = firstArg.text;
            }
            if (decoratorName === "Param") {
              params.push({
                source: "param",
                name: argName || paramName,
                index,
                paramName,
                type: paramType,
                required
              });
              matched = true;
              break;
            } else if (decoratorName === "Query") {
              params.push({
                source: "query",
                name: argName || paramName,
                index,
                paramName,
                type: paramType,
                required
              });
              matched = true;
              break;
            } else if (decoratorName === "Body") {
              params.push({
                source: "body",
                index,
                paramName,
                type: paramType,
                required
              });
              matched = true;
              break;
            } else if (decoratorName === "Header") {
              params.push({
                source: "header",
                name: (argName || paramName).toLowerCase(),
                index,
                paramName,
                type: paramType,
                required
              });
              matched = true;
              break;
            } else if (decoratorName === "Ctx") {
              params.push({
                source: "context",
                index,
                paramName,
                type: "Context",
                required: true
              });
              matched = true;
              break;
            }
          }
        }
      }
      if (!matched) {
        if (paramName === "c" || paramName === "ctx") {
          params.push({
            source: "context",
            index,
            paramName,
            type: "Context",
            required: true
          });
        }
      }
    });
    return params;
  }
  extractMethodOpenApi(node, sourceFile) {
    let summary;
    let description;
    let tags;
    let statusCode;
    let deprecated;
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (ts.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (ts.isIdentifier(expr)) {
          if (expr.text === "ApiOperation") {
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  if (prop.name.text === "summary" && ts.isStringLiteral(prop.initializer)) {
                    summary = prop.initializer.text;
                  } else if (prop.name.text === "description" && ts.isStringLiteral(prop.initializer)) {
                    description = prop.initializer.text;
                  } else if (prop.name.text === "deprecated" && prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
                    deprecated = true;
                  }
                }
              }
            }
          } else if (expr.text === "ApiResponse") {
            const arg = d.expression.arguments[0];
            if (arg && ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  if (prop.name.text === "status" && ts.isNumericLiteral(prop.initializer)) {
                    statusCode = parseInt(prop.initializer.text, 10);
                  }
                }
              }
            }
          } else if (expr.text === "ApiTags") {
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
  extractModelSchema(node) {
    const properties = [];
    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member) && member.name) {
        const propName = member.name.getText();
        const decorators = this.getDecorators(member);
        for (const d of decorators) {
          if (ts.isCallExpression(d.expression)) {
            const expr = d.expression.expression;
            if (ts.isIdentifier(expr) && expr.text === "ApiProperty") {
              let propType = "string";
              if (member.type) {
                propType = member.type.getText();
              }
              const required = !member.questionToken;
              let desc;
              let example;
              const arg = d.expression.arguments[0];
              if (arg && ts.isObjectLiteralExpression(arg)) {
                for (const p of arg.properties) {
                  if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                    if (p.name.text === "description" && ts.isStringLiteral(p.initializer)) {
                      desc = p.initializer.text;
                    } else if (p.name.text === "example" && ts.isStringLiteral(p.initializer)) {
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
                example
              });
            }
          }
        }
      }
    }
    if (properties.length > 0 && node.name) {
      return {
        className: node.name.text,
        properties
      };
    }
    return null;
  }
};

// src/cli/generator.ts
import path2 from "path";
var CodeGenerator = class {
  constructor(parsed) {
    this.parsed = parsed;
  }
  parsed;
  generateHonoRoutes(outputFilePath) {
    const outDir = path2.dirname(path2.resolve(outputFilePath));
    const importStatements = [
      `import type { Hono } from 'hono';`
    ];
    const controllerInstances = [];
    const routeRegistrations = [];
    for (const controller of this.parsed.controllers) {
      let relImport = path2.relative(outDir, controller.filePath);
      relImport = relImport.replace(/\\/g, "/");
      if (!relImport.startsWith(".")) relImport = `./${relImport}`;
      relImport = relImport.replace(/\.ts$/, ".js");
      importStatements.push(
        `import { ${controller.className} } from '${relImport}';`
      );
      const varName = `${this.uncapitalize(controller.className)}`;
      controllerInstances.push(`  const ${varName} = new ${controller.className}();`);
      for (const method of controller.methods) {
        const fullPath = this.combinePaths(controller.basePath, method.path);
        const honoPath = fullPath;
        const handlerCode = this.generateHandlerCode(varName, method);
        routeRegistrations.push(
          `  app.${method.httpMethod}('${honoPath}', ${handlerCode});`
        );
      }
    }
    return `// Auto-generated by @developersailor/gea-openapi-decorators. DO NOT EDIT.
// Zero-reflection, Ahead-of-Time static Hono routes for GeaStack C++ compilation.

${importStatements.join("\n")}

export function registerRoutes(app: Hono): void {
${controllerInstances.join("\n")}

${routeRegistrations.join("\n")}
}
`;
  }
  generateHandlerCode(controllerVar, method) {
    const paramExtracts = [];
    const callArgs = [];
    const sortedParams = [...method.params].sort((a, b) => a.index - b.index);
    for (const p of sortedParams) {
      if (p.source === "param") {
        const varName = `param_${p.name || p.paramName}`;
        paramExtracts.push(`    const ${varName} = c.req.param('${p.name || p.paramName}');`);
        callArgs.push(p.type === "number" ? `Number(${varName})` : varName);
      } else if (p.source === "query") {
        const varName = `query_${p.name || p.paramName}`;
        paramExtracts.push(`    const ${varName} = c.req.query('${p.name || p.paramName}');`);
        callArgs.push(p.type === "number" ? `Number(${varName})` : varName);
      } else if (p.source === "body") {
        const varName = `body_${p.paramName}`;
        paramExtracts.push(`    const ${varName} = await c.req.json();`);
        callArgs.push(varName);
      } else if (p.source === "header") {
        const varName = `header_${(p.name || p.paramName).replace(/[^a-zA-Z0-9]/g, "_")}`;
        paramExtracts.push(`    const ${varName} = c.req.header('${p.name || p.paramName}');`);
        callArgs.push(varName);
      } else if (p.source === "context") {
        callArgs.push("c");
      }
    }
    const awaitKeyword = method.isAsync ? "await " : "";
    const statusCode = method.statusCode ?? (method.httpMethod === "post" ? 201 : 200);
    const callExpression = `${awaitKeyword}${controllerVar}.${method.methodName}(${callArgs.join(", ")})`;
    const lines = [
      `async (c) => {`,
      ...paramExtracts,
      `    const result = ${callExpression};`,
      `    if (result instanceof Response) {`,
      `      return result;`,
      `    }`,
      `    if (result === undefined || result === null) {`,
      `      return c.body(null, ${statusCode === 200 ? 204 : statusCode});`,
      `    }`,
      `    return c.json(result, ${statusCode});`,
      `  }`
    ];
    return lines.join("\n");
  }
  generateOpenApiSpec(title = "GeaStack API", version = "1.0.0") {
    const doc = {
      openapi: "3.1.0",
      info: {
        title,
        version,
        description: "Generated by @developersailor/gea-openapi-decorators"
      },
      paths: {},
      components: {
        schemas: {}
      }
    };
    for (const model of this.parsed.models) {
      const properties = {};
      const requiredProps = [];
      for (const prop of model.properties) {
        properties[prop.name] = {
          type: this.mapTsTypeToOpenApi(prop.type),
          description: prop.description,
          example: prop.example
        };
        if (prop.required) {
          requiredProps.push(prop.name);
        }
      }
      doc.components.schemas[model.className] = {
        type: "object",
        properties,
        required: requiredProps.length > 0 ? requiredProps : void 0
      };
    }
    for (const controller of this.parsed.controllers) {
      for (const method of controller.methods) {
        const fullPath = this.combinePaths(controller.basePath, method.path);
        const openApiPath = fullPath.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
        if (!doc.paths[openApiPath]) {
          doc.paths[openApiPath] = {};
        }
        const tags = Array.from(/* @__PURE__ */ new Set([...controller.tags, ...method.tags || []]));
        const parameters = [];
        let requestBody = void 0;
        for (const p of method.params) {
          if (p.source === "param") {
            parameters.push({
              name: p.name || p.paramName,
              in: "path",
              required: true,
              schema: { type: this.mapTsTypeToOpenApi(p.type) }
            });
          } else if (p.source === "query") {
            parameters.push({
              name: p.name || p.paramName,
              in: "query",
              required: p.required,
              schema: { type: this.mapTsTypeToOpenApi(p.type) }
            });
          } else if (p.source === "header") {
            parameters.push({
              name: p.name || p.paramName,
              in: "header",
              required: p.required,
              schema: { type: "string" }
            });
          } else if (p.source === "body") {
            requestBody = {
              required: true,
              content: {
                "application/json": {
                  schema: this.isCustomModel(p.type) ? { $ref: `#/components/schemas/${p.type}` } : { type: this.mapTsTypeToOpenApi(p.type) }
                }
              }
            };
          }
        }
        const statusCode = method.statusCode ?? (method.httpMethod === "post" ? 201 : 200);
        doc.paths[openApiPath][method.httpMethod] = {
          summary: method.summary || `${method.methodName} operation`,
          description: method.description,
          tags: tags.length > 0 ? tags : void 0,
          deprecated: method.deprecated,
          parameters: parameters.length > 0 ? parameters : void 0,
          requestBody,
          responses: {
            [statusCode]: {
              description: statusCode === 201 ? "Created" : "Successful response",
              content: {
                "application/json": {
                  schema: { type: "object" }
                }
              }
            }
          }
        };
      }
    }
    return doc;
  }
  mapTsTypeToOpenApi(type) {
    switch (type.toLowerCase()) {
      case "number":
        return "integer";
      case "boolean":
        return "boolean";
      case "string":
        return "string";
      case "any":
      default:
        return "string";
    }
  }
  isCustomModel(type) {
    return this.parsed.models.some((m) => m.className === type);
  }
  combinePaths(base, sub) {
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const cleanSub = sub.startsWith("/") ? sub : `/${sub}`;
    let result = `${cleanBase}${cleanSub}`;
    if (result.length > 1 && result.endsWith("/")) {
      result = result.slice(0, -1);
    }
    return result === "" ? "/" : result;
  }
  uncapitalize(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
};

export {
  AstParser,
  CodeGenerator
};
//# sourceMappingURL=chunk-VDBYN4UD.mjs.map