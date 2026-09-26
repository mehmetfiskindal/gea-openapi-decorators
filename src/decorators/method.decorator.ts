import type { HttpMethod } from '../types/index.js';

export function createMethodDecorator(httpMethod: HttpMethod, defaultPath: string = '') {
  return (path: string = defaultPath) => {
    return (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor): void => {
      if (!target.__gea_methods__) {
        target.__gea_methods__ = [];
      }
      target.__gea_methods__.push({
        methodName: String(propertyKey),
        httpMethod,
        path: path.startsWith('/') || path === '' ? path : `/${path}`,
      });
    };
  };
}

export const Get = createMethodDecorator('get', '/');
export const Post = createMethodDecorator('post', '/');
export const Put = createMethodDecorator('put', '/');
export const Delete = createMethodDecorator('delete', '/');
export const Patch = createMethodDecorator('patch', '/');
