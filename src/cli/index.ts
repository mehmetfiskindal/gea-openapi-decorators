import { cac } from 'cac';
import fs from 'node:fs';
import path from 'node:path';
import { AstParser } from './parser.js';
import { CodeGenerator } from './generator.js';

const cli = cac('gea-openapi');

cli
  .command('codegen', 'Generate zero-reflection Hono route bindings and OpenAPI spec')
  .option('-c, --controllers <files...>', 'Controller file paths')
  .option('-m, --models <files...>', 'Model/DTO file paths')
  .option('-r, --out-routes <path>', 'Output path for generated Hono routes', {
    default: 'src/routes.generated.ts',
  })
  .option('-o, --out-openapi <path>', 'Output path for generated OpenAPI JSON', {
    default: 'src/openapi.json',
  })
  .option('-p, --project <path>', 'Path to tsconfig.json')
  .option('--title <title>', 'API Title for OpenAPI spec', { default: 'GeaStack API' })
  .option('--api-version <version>', 'API Version', { default: '1.0.0' })
  .action((options) => {
    const cwd = process.cwd();
    let filePaths: string[] = [];

    const scanDir = (dir: string, pattern: (name: string) => boolean): string[] => {
      if (!fs.existsSync(dir)) return [];
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanDir(full, pattern));
        } else if (entry.isFile() && pattern(entry.name)) {
          files.push(full);
        }
      }
      return files;
    };

    if (options.controllers && options.controllers.length > 0) {
      const cList = Array.isArray(options.controllers) ? options.controllers : [options.controllers];
      filePaths.push(...cList);
    } else {
      filePaths.push(...scanDir(path.resolve(cwd, 'src'), (name) => name.endsWith('.controller.ts') || name.endsWith('-controller.ts')));
    }

    if (options.models && options.models.length > 0) {
      const mList = Array.isArray(options.models) ? options.models : [options.models];
      filePaths.push(...mList);
    } else {
      filePaths.push(...scanDir(path.resolve(cwd, 'src'), (name) => name.endsWith('.dto.ts') || name.endsWith('.model.ts')));
    }

    // Deduplicate
    filePaths = Array.from(new Set(filePaths.map((f) => path.resolve(cwd, f))));

    if (filePaths.length === 0) {
      console.warn('⚠️  No source files found. Specify via --controllers <paths>');
      return;
    }

    console.log(`🔍 Scanning ${filePaths.length} TypeScript file(s)...`);
    const parser = new AstParser(options.project);
    const parsed = parser.parseFiles(filePaths);

    console.log(`✅ Discovered ${parsed.controllers.length} controller(s) and ${parsed.models.length} model(s).`);

    const generator = new CodeGenerator(parsed);

    // 1. Generate Hono Routes
    if (options.outRoutes) {
      const routesPath = path.resolve(cwd, options.outRoutes);
      fs.mkdirSync(path.dirname(routesPath), { recursive: true });
      const routesCode = generator.generateHonoRoutes(routesPath);
      fs.writeFileSync(routesPath, routesCode, 'utf8');
      console.log(`🚀 Generated AOT Hono routes: ${options.outRoutes}`);
    }

    // 2. Generate OpenAPI Spec
    if (options.outOpenapi) {
      const openapiPath = path.resolve(cwd, options.outOpenapi);
      fs.mkdirSync(path.dirname(openapiPath), { recursive: true });
      const spec = generator.generateOpenApiSpec(options.title, options.apiVersion);
      fs.writeFileSync(openapiPath, JSON.stringify(spec, null, 2), 'utf8');
      console.log(`📄 Generated OpenAPI 3.1 spec: ${options.outOpenapi}`);
    }
  });

cli.help();
cli.version('1.0.0');

cli.parse();
