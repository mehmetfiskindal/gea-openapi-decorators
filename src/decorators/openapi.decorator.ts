export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  operationId?: string;
}

export interface ApiResponseOptions {
  status: number;
  description?: string;
  type?: any;
  isArray?: boolean;
}

export interface ApiPropertyOptions {
  type?: string | Function;
  description?: string;
  example?: any;
  required?: boolean;
  enum?: (string | number)[];
  isArray?: boolean;
  format?: string;
  default?: any;
}

export interface ApiParamOptions {
  name: string;
  description?: string;
  required?: boolean;
  type?: string | Function;
  example?: any;
  enum?: (string | number)[];
}

export interface ApiQueryOptions {
  name: string;
  description?: string;
  required?: boolean;
  type?: string | Function;
  example?: any;
  enum?: (string | number)[];
}

export interface ApiHeaderOptions {
  name: string;
  description?: string;
  required?: boolean;
  type?: string | Function;
  example?: any;
}

export interface ApiBodyOptions {
  description?: string;
  required?: boolean;
  type?: any;
  isArray?: boolean;
  mediaType?: string;
}

export interface ApiKeyAuthOptions {
  name: string;
  in?: 'header' | 'query' | 'cookie';
}

export type GeaMethodDecorator = (target: any, propertyKey: string | symbol, descriptor?: any) => void;
export type GeaClassDecorator = (target: any) => void;
export type GeaPropertyDecorator = (target: any, propertyKey: string | symbol) => void;
export type GeaClassOrMethodDecorator = (target: any, propertyKey?: string | symbol, descriptor?: any) => void;

// 1. Tags
export function ApiTags(...tags: string[]): GeaClassOrMethodDecorator {
  return (target: any, propertyKey?: string | symbol): void => {
    if (propertyKey) {
      if (!target.__gea_method_tags__) target.__gea_method_tags__ = {};
      target.__gea_method_tags__[String(propertyKey)] = tags;
    } else {
      target.__gea_tags__ = tags;
    }
  };
}

// 2. Operation
export function ApiOperation(options: ApiOperationOptions): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_operations__) target.__gea_operations__ = {};
    target.__gea_operations__[String(propertyKey)] = options;
  };
}

// 3. Response & Shortcuts
export function ApiResponse(options: ApiResponseOptions): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_responses__) target.__gea_responses__ = {};
    const key = String(propertyKey);
    if (!target.__gea_responses__[key]) target.__gea_responses__[key] = [];
    target.__gea_responses__[key].push(options);
  };
}

function createApiResponseShortcut(status: number, defaultDesc: string) {
  return (options: Omit<ApiResponseOptions, 'status'> = {}): GeaMethodDecorator => {
    return ApiResponse({
      status,
      description: options.description !== undefined ? options.description : defaultDesc,
      type: options.type,
      isArray: options.isArray,
    });
  };
}

export const ApiOkResponse = createApiResponseShortcut(200, 'Successful response');
export const ApiCreatedResponse = createApiResponseShortcut(201, 'Created');
export const ApiAcceptedResponse = createApiResponseShortcut(202, 'Accepted');
export const ApiNoContentResponse = createApiResponseShortcut(204, 'No Content');
export const ApiBadRequestResponse = createApiResponseShortcut(400, 'Bad Request');
export const ApiUnauthorizedResponse = createApiResponseShortcut(401, 'Unauthorized');
export const ApiForbiddenResponse = createApiResponseShortcut(403, 'Forbidden');
export const ApiNotFoundResponse = createApiResponseShortcut(404, 'Not Found');
export const ApiConflictResponse = createApiResponseShortcut(409, 'Conflict');
export const ApiInternalServerErrorResponse = createApiResponseShortcut(500, 'Internal Server Error');

// 4. Property
export function ApiProperty(options: ApiPropertyOptions = {}): GeaPropertyDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_properties__) target.__gea_properties__ = [];
    const prop: Record<string, any> = {
      name: String(propertyKey),
    };
    if (options.type !== undefined) prop.type = options.type;
    if (options.description !== undefined) prop.description = options.description;
    if (options.example !== undefined) prop.example = options.example;
    if (options.required !== undefined) prop.required = options.required;
    if (options.enum !== undefined) prop.enum = options.enum;
    if (options.isArray !== undefined) prop.isArray = options.isArray;
    if (options.format !== undefined) prop.format = options.format;
    if (options.default !== undefined) prop.default = options.default;
    target.__gea_properties__.push(prop);
  };
}

export function ApiHideProperty(): GeaPropertyDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_properties__) target.__gea_properties__ = [];
    target.__gea_properties__.push({
      name: String(propertyKey),
      hide: true,
    });
  };
}

// 5. Security Decorators
export function ApiBearerAuth(name: string = 'bearer'): GeaClassOrMethodDecorator {
  return (target: any, propertyKey?: string | symbol): void => {
    const sec: Record<string, string[]> = {};
    const scopes: string[] = [];
    sec[name] = scopes;
    if (propertyKey) {
      if (!target.__gea_method_security__) target.__gea_method_security__ = {};
      const key = String(propertyKey);
      if (!target.__gea_method_security__[key]) target.__gea_method_security__[key] = [];
      target.__gea_method_security__[key].push(sec);
    } else {
      if (!target.__gea_class_security__) target.__gea_class_security__ = [];
      target.__gea_class_security__.push(sec);
    }
  };
}

export function ApiSecurity(name: string, scopes: string[] = []): GeaClassOrMethodDecorator {
  return (target: any, propertyKey?: string | symbol): void => {
    const sec: Record<string, string[]> = {};
    sec[name] = scopes;
    if (propertyKey) {
      if (!target.__gea_method_security__) target.__gea_method_security__ = {};
      const key = String(propertyKey);
      if (!target.__gea_method_security__[key]) target.__gea_method_security__[key] = [];
      target.__gea_method_security__[key].push(sec);
    } else {
      if (!target.__gea_class_security__) target.__gea_class_security__ = [];
      target.__gea_class_security__.push(sec);
    }
  };
}

export function ApiBasicAuth(name: string = 'basic'): GeaClassOrMethodDecorator {
  return ApiSecurity(name);
}

export function ApiKeyAuth(options: ApiKeyAuthOptions = { name: 'api-key', in: 'header' }): GeaClassOrMethodDecorator {
  return ApiSecurity(options.name);
}

// 6. Media Types (Consumes / Produces)
export function ApiConsumes(...mediaTypes: string[]): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_consumes__) target.__gea_consumes__ = {};
    target.__gea_consumes__[String(propertyKey)] = mediaTypes;
  };
}

export function ApiProduces(...mediaTypes: string[]): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_produces__) target.__gea_produces__ = {};
    target.__gea_produces__[String(propertyKey)] = mediaTypes;
  };
}

// 7. Explicit Method-level Parameter and Body Docs
export function ApiParam(options: ApiParamOptions): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_api_params__) target.__gea_api_params__ = {};
    const key = String(propertyKey);
    if (!target.__gea_api_params__[key]) target.__gea_api_params__[key] = [];
    target.__gea_api_params__[key].push(options);
  };
}

export function ApiQuery(options: ApiQueryOptions): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_api_queries__) target.__gea_api_queries__ = {};
    const key = String(propertyKey);
    if (!target.__gea_api_queries__[key]) target.__gea_api_queries__[key] = [];
    target.__gea_api_queries__[key].push(options);
  };
}

export function ApiHeader(options: ApiHeaderOptions): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_api_headers__) target.__gea_api_headers__ = {};
    const key = String(propertyKey);
    if (!target.__gea_api_headers__[key]) target.__gea_api_headers__[key] = [];
    target.__gea_api_headers__[key].push(options);
  };
}

export function ApiBody(options: ApiBodyOptions): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_api_bodies__) target.__gea_api_bodies__ = {};
    target.__gea_api_bodies__[String(propertyKey)] = options;
  };
}

// 8. Exclusion Decorators
export function ApiExcludeEndpoint(disable: boolean = true): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_exclude_endpoints__) target.__gea_exclude_endpoints__ = {};
    target.__gea_exclude_endpoints__[String(propertyKey)] = disable;
  };
}

export function ApiExcludeController(disable: boolean = true): GeaClassDecorator {
  return (target: any): void => {
    target.__gea_exclude_controller__ = disable;
  };
}

// 9. Extra Models
export function ApiExtraModels(...models: Function[]): GeaClassOrMethodDecorator {
  return (target: any): void => {
    if (!target.__gea_extra_models__) target.__gea_extra_models__ = [];
    for (let i = 0; i < models.length; i++) {
      target.__gea_extra_models__.push(models[i]);
    }
  };
}
