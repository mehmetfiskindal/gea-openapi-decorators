import { ApiProperty } from '../../../../src/index.js';

export class CreateTodoDto {
  @ApiProperty({ description: 'Title of the todo item', example: 'Buy milk' })
  title: string;

  @ApiProperty({ description: 'Detailed description', example: 'Organic whole milk' })
  description?: string;
}

export class TodoDto {
  @ApiProperty({ description: 'Unique ID', example: '1' })
  id: string;

  @ApiProperty({ description: 'Title of the todo item', example: 'Buy milk' })
  title: string;

  @ApiProperty({ description: 'Whether the item is completed', example: false })
  completed: boolean;
}
