"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cli/index.ts
var import_cac = require("cac");
var import_node_fs2 = __toESM(require("fs"));
var import_node_path3 = __toESM(require("path"));

// src/cli/parser.ts
var import_typescript = __toESM(require("typescript"));
var import_node_fs = __toESM(require("fs"));
var import_node_path = __toESM(require("path"));
var AstParser = class {
  constructor(tsConfigPath) {
    this.tsConfigPath = tsConfigPath;
    if (tsConfigPath && import_node_fs.default.existsSync(tsConfigPath)) {
      const configFile = import_typescript.default.readConfigFile(tsConfigPath, import_typescript.default.sys.readFile);
      const parsedConfig = import_typescript.default.parseJsonConfigFileContent(
        configFile.config,
        import_typescript.default.sys,
        import_node_path.default.dirname(tsConfigPath)
      );
      this.program = import_typescript.default.createProgram(parsedConfig.fileNames, parsedConfig.options);
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
      const resolvedPath = import_node_path.default.resolve(filePath);
      if (!import_node_fs.default.existsSync(resolvedPath)) continue;
      const sourceText = import_node_fs.default.readFileSync(resolvedPath, "utf8");
      const sourceFile = this.program?.getSourceFile(resolvedPath) || import_typescript.default.createSourceFile(resolvedPath, sourceText, import_typescript.default.ScriptTarget.Latest, true);
      this.visitNode(sourceFile, sourceFile, resolvedPath, controllers, models);
    }
    return { controllers, models };
  }
  visitNode(node, sourceFile, filePath, controllers, models) {
    if (import_typescript.default.isClassDeclaration(node) && node.name) {
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
    import_typescript.default.forEachChild(node, (child) => this.visitNode(child, sourceFile, filePath, controllers, models));
  }
  getDecorators(node) {
    if (import_typescript.default.canHaveDecorators(node)) {
      return import_typescript.default.getDecorators(node) || [];
    }
    return node.decorators || [];
  }
  extractControllerDecorator(node) {
    const decorators = this.getDecorators(node);
    for (const d of decorators) {
      if (import_typescript.default.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (import_typescript.default.isIdentifier(expr) && expr.text === "Controller") {
          const arg = d.expression.arguments[0];
          let basePath = "";
          if (arg && import_typescript.default.isStringLiteral(arg)) {
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
      if (import_typescript.default.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (import_typescript.default.isIdentifier(expr) && expr.text === "ApiTags") {
          for (const arg of d.expression.arguments) {
            if (import_typescript.default.isStringLiteral(arg)) {
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
      if (import_typescript.default.isMethodDeclaration(member) && member.name) {
        const methodName = member.name.getText(sourceFile);
        const routeMeta = this.extractMethodRouteDecorator(member);
        if (routeMeta) {
          const params = this.extractMethodParameters(member, sourceFile);
          const openApiMeta = this.extractMethodOpenApi(member, sourceFile);
          const isAsync = member.modifiers?.some((m) => m.kind === import_typescript.default.SyntaxKind.AsyncKeyword) ?? false;
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
      if (import_typescript.default.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (import_typescript.default.isIdentifier(expr) && httpVerbs[expr.text]) {
          const httpMethod = httpVerbs[expr.text];
          let routePath = "/";
          const arg = d.expression.arguments[0];
          if (arg && import_typescript.default.isStringLiteral(arg)) {
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
        if (import_typescript.default.isCallExpression(d.expression)) {
          const expr = d.expression.expression;
          if (import_typescript.default.isIdentifier(expr)) {
            const decoratorName = expr.text;
            let argName;
            const firstArg = d.expression.arguments[0];
            if (firstArg && import_typescript.default.isStringLiteral(firstArg)) {
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
      if (import_typescript.default.isCallExpression(d.expression)) {
        const expr = d.expression.expression;
        if (import_typescript.default.isIdentifier(expr)) {
          if (expr.text === "ApiOperation") {
            const arg = d.expression.arguments[0];
            if (arg && import_typescript.default.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (import_typescript.default.isPropertyAssignment(prop) && import_typescript.default.isIdentifier(prop.name)) {
                  if (prop.name.text === "summary" && import_typescript.default.isStringLiteral(prop.initializer)) {
                    summary = prop.initializer.text;
                  } else if (prop.name.text === "description" && import_typescript.default.isStringLiteral(prop.initializer)) {
                    description = prop.initializer.text;
                  } else if (prop.name.text === "deprecated" && prop.initializer.kind === import_typescript.default.SyntaxKind.TrueKeyword) {
                    deprecated = true;
                  }
                }
              }
            }
          } else if (expr.text === "ApiResponse") {
            const arg = d.expression.arguments[0];
            if (arg && import_typescript.default.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (import_typescript.default.isPropertyAssignment(prop) && import_typescript.default.isIdentifier(prop.name)) {
                  if (prop.name.text === "status" && import_typescript.default.isNumericLiteral(prop.initializer)) {
                    statusCode = parseInt(prop.initializer.text, 10);
                  }
                }
              }
            }
          } else if (expr.text === "ApiTags") {
            tags = tags || [];
            for (const arg of d.expression.arguments) {
              if (import_typescript.default.isStringLiteral(arg)) {
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
      if (import_typescript.default.isPropertyDeclaration(member) && member.name) {
        const propName = member.name.getText();
        const decorators = this.getDecorators(member);
        for (const d of decorators) {
          if (import_typescript.default.isCallExpression(d.expression)) {
            const expr = d.expression.expression;
            if (import_typescript.default.isIdentifier(expr) && expr.text === "ApiProperty") {
              let propType = "string";
              if (member.type) {
                propType = member.type.getText();
              }
              const required = !member.questionToken;
              let desc;
              let example;
              const arg = d.expression.arguments[0];
              if (arg && import_typescript.default.isObjectLiteralExpression(arg)) {
                for (const p of arg.properties) {
                  if (import_typescript.default.isPropertyAssignment(p) && import_typescript.default.isIdentifier(p.name)) {
                    if (p.name.text === "description" && import_typescript.default.isStringLiteral(p.initializer)) {
                      desc = p.initializer.text;
                    } else if (p.name.text === "example" && import_typescript.default.isStringLiteral(p.initializer)) {
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
var import_node_path2 = __toESM(require("path"));
var CodeGenerator = class {
  constructor(parsed) {
    this.parsed = parsed;
  }
  parsed;
  generateHonoRoutes(outputFilePath) {
    const outDir = import_node_path2.default.dirname(import_node_path2.default.resolve(outputFilePath));
    const importStatements = [
      `import type { Hono } from 'hono';`
    ];
    const controllerInstances = [];
    const routeRegistrations = [];
    for (const controller of this.parsed.controllers) {
      let relImport = import_node_path2.default.relative(outDir, controller.filePath);
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

// src/cli/index.ts
var cli = (0, import_cac.cac)("gea-openapi");
cli.command("codegen", "Generate zero-reflection Hono route bindings and OpenAPI spec").option("-c, --controllers <files...>", "Controller file paths").option("-m, --models <files...>", "Model/DTO file paths").option("-r, --out-routes <path>", "Output path for generated Hono routes", {
  default: "src/routes.generated.ts"
}).option("-o, --out-openapi <path>", "Output path for generated OpenAPI JSON", {
  default: "src/openapi.json"
}).option("-p, --project <path>", "Path to tsconfig.json").option("--title <title>", "API Title for OpenAPI spec", { default: "GeaStack API" }).option("--api-version <version>", "API Version", { default: "1.0.0" }).action((options) => {
  const cwd = process.cwd();
  let filePaths = [];
  const scanDir = (dir, pattern) => {
    if (!import_node_fs2.default.existsSync(dir)) return [];
    const files = [];
    const entries = import_node_fs2.default.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = import_node_path3.default.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...scanDir(full, pattern));
      } else if (entry.isFile() && pattern(entry.name)) {
        files.push(full);
      }
    }
    return files;
  };
  if (options.controllers && options.controllers.length > 0) {
    const cList = Array.isArray(options.controllers) ? options.controllers : [options.controllers];
    filePaths.push(...cList);
  } else {
    filePaths.push(...scanDir(import_node_path3.default.resolve(cwd, "src"), (name) => name.endsWith(".controller.ts") || name.endsWith("-controller.ts")));
  }
  if (options.models && options.models.length > 0) {
    const mList = Array.isArray(options.models) ? options.models : [options.models];
    filePaths.push(...mList);
  } else {
    filePaths.push(...scanDir(import_node_path3.default.resolve(cwd, "src"), (name) => name.endsWith(".dto.ts") || name.endsWith(".model.ts")));
  }
  filePaths = Array.from(new Set(filePaths.map((f) => import_node_path3.default.resolve(cwd, f))));
  if (filePaths.length === 0) {
    console.warn("\u26A0\uFE0F  No source files found. Specify via --controllers <paths>");
    return;
  }
  console.log(`\u{1F50D} Scanning ${filePaths.length} TypeScript file(s)...`);
  const parser = new AstParser(options.project);
  const parsed = parser.parseFiles(filePaths);
  console.log(`\u2705 Discovered ${parsed.controllers.length} controller(s) and ${parsed.models.length} model(s).`);
  const generator = new CodeGenerator(parsed);
  if (options.outRoutes) {
    const routesPath = import_node_path3.default.resolve(cwd, options.outRoutes);
    import_node_fs2.default.mkdirSync(import_node_path3.default.dirname(routesPath), { recursive: true });
    const routesCode = generator.generateHonoRoutes(routesPath);
    import_node_fs2.default.writeFileSync(routesPath, routesCode, "utf8");
    console.log(`\u{1F680} Generated AOT Hono routes: ${options.outRoutes}`);
  }
  if (options.outOpenapi) {
    const openapiPath = import_node_path3.default.resolve(cwd, options.outOpenapi);
    import_node_fs2.default.mkdirSync(import_node_path3.default.dirname(openapiPath), { recursive: true });
    const spec = generator.generateOpenApiSpec(options.title, options.apiVersion);
    import_node_fs2.default.writeFileSync(openapiPath, JSON.stringify(spec, null, 2), "utf8");
    console.log(`\u{1F4C4} Generated OpenAPI 3.1 spec: ${options.outOpenapi}`);
  }
});
cli.help();
cli.version("1.0.0");
cli.parse();
//# sourceMappingURL=cli.js.map