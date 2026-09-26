
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
