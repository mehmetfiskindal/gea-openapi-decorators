export type GeaMethodDecorator = (target: any, propertyKey: string | symbol, descriptor?: any) => void;
export type GeaClassOrMethodDecorator = (target: any, propertyKey?: string | symbol, descriptor?: any) => void;

/**
 * Overrides the default HTTP response status code for a route handler.
 * Example: @HttpCode(204)
 */
export function HttpCode(statusCode: number): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_http_codes__) target.__gea_http_codes__ = {};
    target.__gea_http_codes__[String(propertyKey)] = statusCode;
  };
}

/**
 * Issues an automatic HTTP redirect response.
 * Example: @Redirect('/login', 302)
 */
export function Redirect(url: string, status: number = 302): GeaMethodDecorator {
  return (target: any, propertyKey: string | symbol): void => {
    if (!target.__gea_redirects__) target.__gea_redirects__ = {};
    target.__gea_redirects__[String(propertyKey)] = { url, status };
  };
}

/**
 * Attaches one or more Hono middlewares to a controller or individual route.
 * Example: @Use(authMiddleware, loggerMiddleware)
 */
export function Use(...middlewares: any[]): GeaClassOrMethodDecorator {
  return (target: any, propertyKey?: string | symbol): void => {
    if (propertyKey) {
      if (!target.__gea_method_middlewares__) target.__gea_method_middlewares__ = {};
      const key = String(propertyKey);
      if (!target.__gea_method_middlewares__[key]) target.__gea_method_middlewares__[key] = [];
      for (let i = 0; i < middlewares.length; i++) {
        target.__gea_method_middlewares__[key].push(middlewares[i]);
      }
    } else {
      if (!target.__gea_class_middlewares__) target.__gea_class_middlewares__ = [];
      for (let i = 0; i < middlewares.length; i++) {
        target.__gea_class_middlewares__.push(middlewares[i]);
      }
    }
  };
}

export const UseMiddleware = Use;
