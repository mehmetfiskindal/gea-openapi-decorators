import {
  AstParser,
  CodeGenerator
} from "./chunk-VDBYN4UD.mjs";

// src/decorators/controller.decorator.ts
function Controller(basePath = "") {
  return (target) => {
    target.__gea_controller__ = {
      basePath: basePath.startsWith("/") ? basePath : `/${basePath}`
    };
  };
}

// src/decorators/method.decorator.ts
function createMethodDecorator(httpMethod, defaultPath = "") {
  return (path = defaultPath) => {
    return (target, propertyKey, _descriptor) => {
      if (!target.__gea_methods__) {
        target.__gea_methods__ = [];
      }
      target.__gea_methods__.push({
        methodName: String(propertyKey),
        httpMethod,
        path: path.startsWith("/") || path === "" ? path : `/${path}`
      });
    };
  };
}
var Get = createMethodDecorator("get", "/");
var Post = createMethodDecorator("post", "/");
var Put = createMethodDecorator("put", "/");
var Delete = createMethodDecorator("delete", "/");
var Patch = createMethodDecorator("patch", "/");

// src/decorators/params.decorator.ts
function createParamDecorator(source) {
  return (name) => {
    return (target, propertyKey, parameterIndex) => {
      if (!propertyKey) return;
      if (!target.__gea_params__) {
        target.__gea_params__ = {};
      }
      const key = String(propertyKey);
      if (!target.__gea_params__[key]) {
        target.__gea_params__[key] = [];
      }
      target.__gea_params__[key].push({
        source,
        name,
        index: parameterIndex
      });
    };
  };
}
var Param = createParamDecorator("param");
var Query = createParamDecorator("query");
var Body = createParamDecorator("body");
var Header = createParamDecorator("header");
var Ctx = createParamDecorator("context");

// src/decorators/openapi.decorator.ts
function ApiTags(...tags) {
  return (target, propertyKey) => {
    if (propertyKey) {
      if (!target.__gea_method_tags__) target.__gea_method_tags__ = {};
      target.__gea_method_tags__[String(propertyKey)] = tags;
    } else {
      target.__gea_tags__ = tags;
    }
  };
}
function ApiOperation(options) {
  return (target, propertyKey) => {
    if (!target.__gea_operations__) target.__gea_operations__ = {};
    target.__gea_operations__[String(propertyKey)] = options;
  };
}
function ApiResponse(options) {
  return (target, propertyKey) => {
    if (!target.__gea_responses__) target.__gea_responses__ = {};
    const key = String(propertyKey);
    if (!target.__gea_responses__[key]) target.__gea_responses__[key] = [];
    target.__gea_responses__[key].push(options);
  };
}
function ApiProperty(options = {}) {
  return (target, propertyKey) => {
    if (!target.__gea_properties__) target.__gea_properties__ = [];
    target.__gea_properties__.push({
      name: String(propertyKey),
      ...options
    });
  };
}
export {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
  AstParser,
  Body,
  CodeGenerator,
  Controller,
  Ctx,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  createMethodDecorator,
  createParamDecorator
};
//# sourceMappingURL=index.mjs.map