export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  deprecated?: boolean;
}

export interface ApiResponseOptions {
  status: number;
  description?: string;
  type?: any;
}

export interface ApiPropertyOptions {
  type?: string | Function;
  description?: string;
  example?: any;
  required?: boolean;
  enum?: (string | number)[];
}

export function ApiTags(...tags: string[]): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol): void => {
    if (propertyKey) {
      if (!target.__gea_method_tags__) target.__gea_method_tags__ = {};
      target.__gea_method_tags__[String(propertyKey)] = tags;
    } else {
      target.__gea_tags__ = tags;
    }
  };
}

export function ApiOperation(options: ApiOperationOptions): MethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_operations__) target.__gea_operations__ = {};
    target.__gea_operations__[String(propertyKey)] = options;
  };
}

export function ApiResponse(options: ApiResponseOptions): MethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_responses__) target.__gea_responses__ = {};
    const key = String(propertyKey);
    if (!target.__gea_responses__[key]) target.__gea_responses__[key] = [];
    target.__gea_responses__[key].push(options);
  };
}

export function ApiProperty(options: ApiPropertyOptions = {}): PropertyDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_properties__) target.__gea_properties__ = [];
    target.__gea_properties__.push({
      name: String(propertyKey),
      ...options,
    });
  };
}
