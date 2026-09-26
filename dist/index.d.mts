/**
 * Controller decorator to mark a class as a route controller.
 * Can be analyzed statically by the code generator and used at runtime.
 */
declare function Controller(basePath?: string): ClassDecorator;

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
type ParamSource = 'param' | 'query' | 'body' | 'header' | 'context';
interface ParamInfo {
    source: ParamSource;
    name?: string;
    index: number;
    paramName: string;
    type: string;
    required: boolean;
}
interface RouteMethodInfo {
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
interface ControllerInfo {
    className: string;
    filePath: string;
    basePath: string;
    tags: string[];
    methods: RouteMethodInfo[];
}
interface PropertySchemaInfo {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    example?: any;
    enum?: (string | number)[];
}
interface ModelSchemaInfo {
    className: string;
    properties: PropertySchemaInfo[];
}
interface ParsedProject {
    controllers: ControllerInfo[];
    models: ModelSchemaInfo[];
}
interface CodegenOptions {
    controllers: string[];
    routesOutput: string;
    openapiOutput?: string;
    title?: string;
    version?: string;
    description?: string;
    basePath?: string;
    tsConfigPath?: string;
}
interface OpenApiSchemaObject {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    items?: any;
    enum?: (string | number)[];
    description?: string;
    example?: any;
    $ref?: string;
}
interface OpenApiDocument {
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
    tags?: {
        name: string;
        description?: string;
    }[];
}

declare function createMethodDecorator(httpMethod: HttpMethod, defaultPath?: string): (path?: string) => (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) => void;
declare const Get: (path?: string) => (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) => void;
declare const Post: (path?: string) => (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) => void;
declare const Put: (path?: string) => (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) => void;
declare const Delete: (path?: string) => (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) => void;
declare const Patch: (path?: string) => (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) => void;

declare function createParamDecorator(source: ParamSource): (name?: string) => ParameterDecorator;
declare const Param: (name?: string) => ParameterDecorator;
declare const Query: (name?: string) => ParameterDecorator;
declare const Body: (name?: string) => ParameterDecorator;
declare const Header: (name?: string) => ParameterDecorator;
declare const Ctx: (name?: string) => ParameterDecorator;

interface ApiOperationOptions {
    summary?: string;
    description?: string;
    deprecated?: boolean;
}
interface ApiResponseOptions {
    status: number;
    description?: string;
    type?: any;
}
interface ApiPropertyOptions {
    type?: string | Function;
    description?: string;
    example?: any;
    required?: boolean;
    enum?: (string | number)[];
}
declare function ApiTags(...tags: string[]): ClassDecorator & MethodDecorator;
declare function ApiOperation(options: ApiOperationOptions): MethodDecorator;
declare function ApiResponse(options: ApiResponseOptions): MethodDecorator;
declare function ApiProperty(options?: ApiPropertyOptions): PropertyDecorator;

declare class AstParser {
    private tsConfigPath?;
    private program;
    private checker;
    constructor(tsConfigPath?: string | undefined);
    parseFiles(filePaths: string[]): ParsedProject;
    private visitNode;
    private getDecorators;
    private extractControllerDecorator;
    private extractClassTags;
    private extractRouteMethods;
    private extractMethodRouteDecorator;
    private extractMethodParameters;
    private extractMethodOpenApi;
    private extractModelSchema;
}

declare class CodeGenerator {
    private parsed;
    constructor(parsed: ParsedProject);
    generateHonoRoutes(outputFilePath: string): string;
    private generateHandlerCode;
    generateOpenApiSpec(title?: string, version?: string): OpenApiDocument;
    private mapTsTypeToOpenApi;
    private isCustomModel;
    private combinePaths;
    private uncapitalize;
}

export { ApiOperation, type ApiOperationOptions, ApiProperty, type ApiPropertyOptions, ApiResponse, type ApiResponseOptions, ApiTags, AstParser, Body, CodeGenerator, type CodegenOptions, Controller, type ControllerInfo, Ctx, Delete, Get, Header, type HttpMethod, type ModelSchemaInfo, type OpenApiDocument, type OpenApiSchemaObject, Param, type ParamInfo, type ParamSource, type ParsedProject, Patch, Post, type PropertySchemaInfo, Put, Query, type RouteMethodInfo, createMethodDecorator, createParamDecorator };
