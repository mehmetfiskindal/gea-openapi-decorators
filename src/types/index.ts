export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type ParamSource = 'param' | 'query' | 'body' | 'header' | 'context';

export interface ParamInfo {
  source: ParamSource;
  name?: string;
  index: number;
  paramName: string;
  type: string;
  required: boolean;
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
}

export interface ControllerInfo {
  className: string;
  filePath: string;
  basePath: string;
  tags: string[];
  methods: RouteMethodInfo[];
}

export interface PropertySchemaInfo {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: any;
  enum?: (string | number)[];
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
}
