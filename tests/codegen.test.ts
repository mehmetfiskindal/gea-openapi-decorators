import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { AstParser } from '../src/cli/parser.js';
import { CodeGenerator } from '../src/cli/generator.js';

describe('AOT Codegen & AST Parser', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/user.controller.ts');

  // Create temporary fixture
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(
    fixturePath,
    `
import { Controller, Get, Post, Param, Query, Body, Header, ApiTags, ApiOperation, ApiResponse, ApiProperty } from '../../src/index.js';

export class CreateUserDto {
  @ApiProperty({ description: 'User display name', example: 'Alice' })
  name: string;

  @ApiProperty({ description: 'User age', example: 25 })
  age?: number;
}

@ApiTags('Users')
@Controller('/users')
export class UserController {
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return { id, name: 'Alice' };
  }

  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @Post('/')
  async createUser(@Body() dto: CreateUserDto) {
    return { id: 'new-id', ...dto };
  }

  @ApiOperation({ summary: 'Search users' })
  @Get('/search')
  search(@Query('q') query: string, @Header('x-api-key') apiKey: string) {
    return { query, apiKey, results: [] };
  }
}
`,
    'utf8'
  );

  it('should parse controllers, methods, and parameters from AST', () => {
    const parser = new AstParser();
    const parsed = parser.parseFiles([fixturePath]);

    expect(parsed.controllers).toHaveLength(1);
    const controller = parsed.controllers[0];
    expect(controller.className).toBe('UserController');
    expect(controller.basePath).toBe('/users');
    expect(controller.tags).toContain('Users');
    expect(controller.methods).toHaveLength(3);

    // getUser method
    const getUser = controller.methods.find((m) => m.methodName === 'getUser');
    expect(getUser).toBeDefined();
    expect(getUser?.httpMethod).toBe('get');
    expect(getUser?.path).toBe('/:id');
    expect(getUser?.params).toHaveLength(1);
    expect(getUser?.params[0].source).toBe('param');
    expect(getUser?.params[0].name).toBe('id');

    // createUser method
    const createUser = controller.methods.find((m) => m.methodName === 'createUser');
    expect(createUser).toBeDefined();
    expect(createUser?.httpMethod).toBe('post');
    expect(createUser?.path).toBe('/');
    expect(createUser?.params).toHaveLength(1);
    expect(createUser?.params[0].source).toBe('body');

    // search method
    const search = controller.methods.find((m) => m.methodName === 'search');
    expect(search).toBeDefined();
    expect(search?.params).toHaveLength(2);
    expect(search?.params[0].source).toBe('query');
    expect(search?.params[0].name).toBe('q');
    expect(search?.params[1].source).toBe('header');
    expect(search?.params[1].name).toBe('x-api-key');

    // DTO model
    expect(parsed.models).toHaveLength(1);
    expect(parsed.models[0].className).toBe('CreateUserDto');
    expect(parsed.models[0].properties).toHaveLength(2);
  });

  it('should generate zero-reflection Hono routes for GeaStack C++ compilation', () => {
    const parser = new AstParser();
    const parsed = parser.parseFiles([fixturePath]);
    const generator = new CodeGenerator(parsed);

    const routesCode = generator.generateHonoRoutes('src/routes.generated.ts');

    // Verify static class instantiation (No dynamic new or reflection)
    expect(routesCode).toContain('const userController = new UserController();');

    // Verify static direct method calls
    expect(routesCode).toContain("app.get('/users/:id'");
    expect(routesCode).toContain("c.req.param('id')");
    expect(routesCode).toContain('userController.getUser(param_id)');

    // Verify POST body handling
    expect(routesCode).toContain("app.post('/users'");
    expect(routesCode).toContain('await c.req.json()');
    expect(routesCode).toContain('userController.createUser(body_dto)');

    // Verify Query and Header handling
    expect(routesCode).toContain("c.req.query('q')");
    expect(routesCode).toContain("c.req.header('x-api-key')");

    // Must NOT contain any dynamic reflection
    expect(routesCode).not.toContain('instance[method');
    expect(routesCode).not.toContain('Reflect.');
  });

  it('should generate complete OpenAPI 3.1 specification document', () => {
    const parser = new AstParser();
    const parsed = parser.parseFiles([fixturePath]);
    const generator = new CodeGenerator(parsed);

    const spec = generator.generateOpenApiSpec('My API', '2.0.0');

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('My API');
    expect(spec.info.version).toBe('2.0.0');

    // Path check (note :id is converted to {id})
    expect(spec.paths['/users/{id}']).toBeDefined();
    expect(spec.paths['/users/{id}'].get.summary).toBe('Get user by ID');
    expect(spec.paths['/users/{id}'].get.parameters[0].name).toBe('id');
    expect(spec.paths['/users/{id}'].get.parameters[0].in).toBe('path');

    // Schema check
    expect(spec.components?.schemas?.CreateUserDto).toBeDefined();
    expect(spec.components?.schemas?.CreateUserDto.properties?.name.description).toBe('User display name');
  });
});
