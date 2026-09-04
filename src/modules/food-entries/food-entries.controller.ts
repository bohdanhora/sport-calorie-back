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
import { Throttle } from '@nestjs/throttler';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { DateQueryDto } from '../../common/dto/date-query.dto';
import { FoodParsingService } from '../nutrition-provider/food-parsing.service';
import { ParseFoodDto, ParsedFoodDto } from '../nutrition-provider/dto/parse-food.dto';
import { CreateFoodEntryDto, UpdateFoodEntryDto } from './dto/food-entry-request.dto';
import { FoodEntryDto } from './dto/food-entry-response.dto';
import { FoodEntriesService } from './food-entries.service';

const PARSE_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

@ApiTags('food-entries')
@ApiBearerAuth()
@Controller('food-entries')
export class FoodEntriesController {
  constructor(
    private readonly foodEntriesService: FoodEntriesService,
    private readonly foodParsingService: FoodParsingService,
  ) {}

  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @Throttle(PARSE_THROTTLE)
  @ApiOperation({
    summary: 'Estimate nutrition for a described portion using the configured provider',
    description:
      'Returns a draft that pre-fills the entry form. Nothing is logged until the user saves it.',
  })
  @ApiOkResponse({ type: ParsedFoodDto })
  parse(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParseFoodDto): Promise<ParsedFoodDto> {
    return this.foodParsingService.parse(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Food logged on a given day' })
  @ApiOkResponse({ type: [FoodEntryDto] })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateQueryDto,
  ): Promise<FoodEntryDto[]> {
    return this.foodEntriesService.listByDate(user.id, query.date);
  }

  @Post()
  @ApiOperation({ summary: 'Log food, either from a saved food or as a one-off entry' })
  @ApiOkResponse({ type: FoodEntryDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFoodEntryDto,
  ): Promise<FoodEntryDto> {
    return this.foodEntriesService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a logged food entry' })
  @ApiOkResponse({ type: FoodEntryDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFoodEntryDto,
  ): Promise<FoodEntryDto> {
    return this.foodEntriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a logged food entry' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.foodEntriesService.remove(user.id, id);
  }
}
