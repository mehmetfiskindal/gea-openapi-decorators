import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '../../../../src/index.js';
import { CreateTodoDto, TodoDto } from '../models/todo.dto.js';

@ApiTags('Todos')
@Controller('/todos')
export class TodoController {
  private todos: TodoDto[] = [
    { id: '1', title: 'Learn GeaStack', completed: true },
    { id: '2', title: 'Build fast C++ APIs', completed: false },
  ];

  @ApiOperation({ summary: 'List all todos' })
  @ApiResponse({ status: 200, description: 'List of todos' })
  @Get('/')
  list(@Query('search') search?: string) {
    if (search) {
      return this.todos.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
    }
    return this.todos;
  }

  @ApiOperation({ summary: 'Get a todo by ID' })
  @ApiResponse({ status: 200, description: 'The requested todo item' })
  @Get('/:id')
  getById(@Param('id') id: string) {
    const item = this.todos.find((t) => t.id === id);
    if (!item) {
      return { error: 'Not found' };
    }
    return item;
  }

  @ApiOperation({ summary: 'Create a new todo' })
  @ApiResponse({ status: 201, description: 'Created todo' })
  @Post('/')
  create(@Body() body: CreateTodoDto) {
    const newTodo: TodoDto = {
      id: String(this.todos.length + 1),
      title: body.title,
      completed: false,
    };
    this.todos.push(newTodo);
    return newTodo;
  }

  @ApiOperation({ summary: 'Delete a todo by ID' })
  @ApiResponse({ status: 204, description: 'Todo deleted' })
  @Delete('/:id')
  delete(@Param('id') id: string) {
    this.todos = this.todos.filter((t) => t.id !== id);
    return null;
  }
}
