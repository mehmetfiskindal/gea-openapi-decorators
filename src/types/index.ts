export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'all';

export type ParamSource =
  | 'param'
  | 'query'
  | 'body'
  | 'header'
  | 'context'
  | 'req'
  | 'res'
  | 'cookie'
  | 'queries'
  | 'headers'
  | 'params';

export interface ParamInfo {
  source: ParamSource;
  name?: string;
  index: number;
  paramName: string;
  type: string;
  required: boolean;
}

export interface ApiParamInfo {
  name: string;
  description?: string;
  required?: boolean;
  type?: string;
  example?: any;
}

export interface ApiQueryInfo {
  name: string;
  description?: string;
  required?: boolean;
  type?: string;
  example?: any;
}

export interface ApiHeaderInfo {
  name: string;
  description?: string;
  required?: boolean;
  type?: string;
  example?: any;
}

export interface ApiBodyInfo {
  description?: string;
  required?: boolean;
  type?: string;
  mediaType?: string;
}

export interface ApiResponseInfo {
  status: number;
  description?: string;
  type?: any;
}

export type ApiSecurityRequirement = Record<string, string[]>;

export interface RedirectInfo {
  url: string;
  status?: number;
}

export interface RouteMethodInfo {
  methodName: string;
  httpMethod: HttpMethod;
  path: string;
  isAsync: boolean;
  params: ParamInfo[];
  returnType?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  statusCode?: number;
  deprecated?: boolean;
  middlewares?: string[];
  httpCode?: number;
  redirect?: RedirectInfo;
  security?: ApiSecurityRequirement[];
  consumes?: string[];
  produces?: string[];
  apiParams?: ApiParamInfo[];
  apiQueries?: ApiQueryInfo[];
  apiHeaders?: ApiHeaderInfo[];
  apiBody?: ApiBodyInfo;
  responses?: ApiResponseInfo[];
  exclude?: boolean;
}

export interface ControllerInfo {
  className: string;
  filePath: string;
  basePath: string;
  tags: string[];
  methods: RouteMethodInfo[];
  security?: ApiSecurityRequirement[];
  middlewares?: string[];
  exclude?: boolean;
  extraModels?: string[];
}

export interface PropertySchemaInfo {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: any;
  enum?: (string | number)[];
  hide?: boolean;
}

export interface ModelSchemaInfo {
  className: string;
  properties: PropertySchemaInfo[];
}

export interface ParsedProject {
  controllers: ControllerInfo[];
  models: ModelSchemaInfo[];
}

export interface CodegenOptions {
  controllers: string[];
  routesOutput: string;
  openapiOutput?: string;
  title?: string;
  version?: string;
  description?: string;
  basePath?: string;
  tsConfigPath?: string;
}

export interface OpenApiSchemaObject {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  enum?: (string | number)[];
  description?: string;
  example?: any;
  $ref?: string;
}

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, OpenApiSchemaObject>;
    securitySchemes?: Record<string, any>;
  };
  tags?: { name: string; description?: string }[];
  security?: ApiSecurityRequirement[];
}
