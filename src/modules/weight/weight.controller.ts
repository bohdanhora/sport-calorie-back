import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { LocalDatePipe } from '../../common/pipes/local-date.pipe';
import {
  UpsertWeightDto,
  WeightEntryDto,
  WeightHistoryQueryDto,
  WeightSummaryDto,
} from './dto/weight.dto';
import { WeightService } from './weight.service';

@ApiTags('weight')
@ApiBearerAuth()
@Controller('weight')
export class WeightController {
  constructor(private readonly weightService: WeightService) {}

  @Get()
  @ApiOperation({ summary: 'Weight history with the current trend' })
  @ApiOkResponse({ type: WeightSummaryDto })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WeightHistoryQueryDto,
  ): Promise<WeightSummaryDto> {
    return this.weightService.getSummary(user.id, query);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Record the weight for a day, replacing any earlier value' })
  @ApiOkResponse({ type: WeightEntryDto })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date', LocalDatePipe) date: string,
    @Body() dto: UpsertWeightDto,
  ): Promise<WeightEntryDto> {
    return this.weightService.upsert(user.id, date, dto);
  }

  @Delete(':date')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the weight recorded for a day' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date', LocalDatePipe) date: string,
  ): Promise<void> {
    return this.weightService.remove(user.id, date);
  }
}
