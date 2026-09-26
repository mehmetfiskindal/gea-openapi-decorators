import type { ParamSource } from '../types/index.js';

export function createParamDecorator(source: ParamSource) {
  return (name?: string): ParameterDecorator => {
    return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number): void => {
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
        index: parameterIndex,
      });
    };
  };
}

export const Param = createParamDecorator('param');
export const Query = createParamDecorator('query');
export const Body = createParamDecorator('body');
export const Header = createParamDecorator('header');
export const Ctx = createParamDecorator('context');
