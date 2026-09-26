import { defineConfig } from 'vitest/config';
import { transformSync } from 'esbuild';

export default defineConfig({
  plugins: [
    {
      name: 'ts-decorators-transform',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.ts') && !id.includes('node_modules')) {
          const result = transformSync(code, {
            loader: 'ts',
            target: 'es2022',
            sourcefile: id,
            sourcemap: true,
            tsconfigRaw: {
              compilerOptions: {
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
              },
            },
          });
          return {
            code: result.code,
            map: result.map ? JSON.parse(result.map) : undefined,
          };
        }
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '../../src/index.js': new URL('./src/index.ts', import.meta.url).pathname,
      '../src/index.js': new URL('./src/index.ts', import.meta.url).pathname,
      './routes.generated.js': new URL('./examples/basic/src/routes.generated.ts', import.meta.url).pathname,
      '../examples/basic/src/routes.generated.js': new URL('./examples/basic/src/routes.generated.ts', import.meta.url).pathname,
      './controllers/todo.controller.js': new URL('./examples/basic/src/controllers/todo.controller.ts', import.meta.url).pathname,
    },
  },
});
