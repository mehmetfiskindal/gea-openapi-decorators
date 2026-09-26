import {
  Controller,
  Get,
  Post,
  Options,
  Head,
  All,
  Param,
  Query,
  Body,
  Header,
  Cookie,
  Queries,
  Headers,
  Params,
  Req,
  Res,
  HttpCode,
  Redirect,
  Use,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiProduces,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
  ApiExcludeEndpoint,
  ApiProperty,
  ApiHideProperty,
} from '../src/index.js';

class CreateItemDto {
  @ApiProperty({ description: 'Item title' })
  title: string;

  @ApiHideProperty()
  internalSecret: string;

  constructor(title: string = '', internalSecret: string = '') {
    this.title = title;
    this.internalSecret = internalSecret;
  }
}

const dummyMiddleware = (c: any, next: any) => next();

@ApiTags('Items')
@ApiBearerAuth('bearer')
@Use(dummyMiddleware)
@Controller('/items')
export class ItemController {
  @ApiOperation({ summary: 'Get item' })
  @ApiOkResponse({ description: 'Found' })
  @ApiParam({ name: 'id' })
  @Get('/:id')
  getItem(@Param('id') id: string): string {
    return id;
  }

  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({ description: 'Payload' })
  @Post('/')
  createItem(@Body() body: CreateItemDto): string {
    return body.title;
  }

  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Options response' })
  @Options('/options')
  optionsItem(): void {}

  @Head('/ping')
  headPing(): void {}

  @All('/all')
  handleAll(@Req() req: any, @Res() res: any): void {}

  @Redirect('/target', 302)
  @Get('/redirect')
  redirectRoute(): void {}

  @ApiQuery({ name: 'q' })
  @ApiHeader({ name: 'x-custom' })
  @ApiNotFoundResponse({ description: 'Not found' })
  @Get('/search')
  search(
    @Query('q') query: string,
    @Header('x-custom') customHeader: string,
    @Cookie('session') session: string,
    @Queries() allQueries: any,
    @Headers() allHeaders: any,
    @Params() allParams: any
  ): string {
    return query;
  }

  @ApiExcludeEndpoint()
  @Get('/hidden')
  hidden(): void {}
}
