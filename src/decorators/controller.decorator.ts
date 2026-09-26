/**
 * Controller decorator to mark a class as a route controller.
 * Can be analyzed statically by the code generator and used at runtime.
 */
export function Controller(basePath: string = ''): ClassDecorator {
  return (target: Function) => {
    (target as any).__gea_controller__ = {
      basePath: basePath.startsWith('/') ? basePath : `/${basePath}`,
    };
  };
}
