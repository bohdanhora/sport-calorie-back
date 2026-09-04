import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { DateQueryDto, DateRangeQueryDto } from '../../common/dto/date-query.dto';
import { UserContextService } from '../user-context/user-context.service';
import { DailySummaryService } from './daily-summary.service';
import { DailySummaryDto, DayOverviewDto, ProgressDto } from './dto/summary-response.dto';
import { ProgressService } from './progress.service';

@ApiTags('summary')
@ApiBearerAuth()
@Controller()
export class SummaryController {
  constructor(
    private readonly dailySummary: DailySummaryService,
    private readonly progress: ProgressService,
    private readonly userContext: UserContextService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Everything one day needs: calories, macros, meals, walking, activities, weight',
  })
  @ApiOkResponse({ type: DailySummaryDto })
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateQueryDto,
  ): Promise<DailySummaryDto> {
    const date = await this.userContext.resolveDate(user.id, query.date);
    return this.dailySummary.getDay(user.id, date);
  }

  @Get('history')
  @ApiOperation({ summary: 'Compact per-day totals for browsing previous days' })
  @ApiOkResponse({ type: [DayOverviewDto] })
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<DayOverviewDto[]> {
    const range = await this.progress.resolveRange(user.id, query.from, query.to);
    return this.progress.getDayOverviews(user.id, range);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Trends, weekly averages and activity breakdown over a range' })
  @ApiOkResponse({ type: ProgressDto })
  getProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<ProgressDto> {
    return this.progress.getProgress(user.id, query.from, query.to);
  }
}
