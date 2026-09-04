import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import {
  CreateFoodDto,
  FoodQueryDto,
  RecentFoodsQueryDto,
  UpdateFoodDto,
} from './dto/food-request.dto';
import { FoodDto, PaginatedFoodsDto } from './dto/food-response.dto';
import { FoodsService } from './foods.service';

@ApiTags('foods')
@ApiBearerAuth()
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get()
  @ApiOperation({ summary: 'Reusable foods owned by the user plus the shared catalog' })
  @ApiOkResponse({ type: PaginatedFoodsDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FoodQueryDto,
  ): Promise<PaginatedFoodsDto> {
    return this.foodsService.list(user.id, query);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Foods the user logged most recently' })
  @ApiOkResponse({ type: [FoodDto] })
  listRecent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentFoodsQueryDto,
  ): Promise<FoodDto[]> {
    return this.foodsService.listRecent(user.id, query.limit);
  }

  @Post()
  @ApiOperation({ summary: 'Create a reusable food' })
  @ApiOkResponse({ type: FoodDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFoodDto): Promise<FoodDto> {
    return this.foodsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a food the user owns' })
  @ApiOkResponse({ type: FoodDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFoodDto,
  ): Promise<FoodDto> {
    return this.foodsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive a food',
    description: 'Already logged entries keep their own copy of the nutrition values.',
  })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.foodsService.archive(user.id, id);
  }
}
