import type { HttpMethod } from '../types/index.js';

export type GeaMethodDecorator = (
  target: any,
  propertyKey: string | symbol,
  descriptor?: any
) => void;

export function createMethodDecorator(httpMethod: HttpMethod, defaultPath: string = '') {
  return (path: string = defaultPath): GeaMethodDecorator => {
    return (target: any, propertyKey: string | symbol, _descriptor?: any): void => {
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
export const Options = createMethodDecorator('options', '/');
export const Head = createMethodDecorator('head', '/');
export const All = createMethodDecorator('all', '/');
