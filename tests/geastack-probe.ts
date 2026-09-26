import {
  Controller,
  Get,
  Post,
  Param,
  Body,
} from '../src/index.js';

class CreateItemDto {
  title!: string;
}

@Controller('/items')
export class ItemController {
  @Get('/:id')
  getItem(@Param('id') id: string): string {
    return id;
  }

  @Post('/')
  createItem(@Body() body: CreateItemDto): string {
    return body.title;
  }
}
