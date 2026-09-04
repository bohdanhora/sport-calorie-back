import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { DateQueryDto } from '../../common/dto/date-query.dto';
import { LocalDatePipe } from '../../common/pipes/local-date.pipe';
import { UserContextService } from '../user-context/user-context.service';
import { SetDailyTargetDto } from './dto/set-daily-target.dto';
import { DailyTargetDto, EnergyProfileDto } from './dto/target-response.dto';
import { TargetsService } from './targets.service';

@ApiTags('targets')
@ApiBearerAuth()
@Controller('targets')
export class TargetsController {
  constructor(
    private readonly targetsService: TargetsService,
    private readonly userContext: UserContextService,
  ) {}

  @Get('energy')
  @ApiOperation({ summary: 'Estimated BMR, TDEE and the recommended calorie target' })
  @ApiOkResponse({ type: EnergyProfileDto })
  getEnergyProfile(@CurrentUser() user: AuthenticatedUser): Promise<EnergyProfileDto> {
    return this.targetsService.getEnergyProfile(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Resolved calorie and macro target for a day' })
  @ApiOkResponse({ type: DailyTargetDto })
  async getDailyTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateQueryDto,
  ): Promise<DailyTargetDto> {
    const date = await this.userContext.resolveDate(user.id, query.date);
    return this.targetsService.resolveDailyTarget(user.id, date);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Override the calorie target for a single day' })
  @ApiOkResponse({ type: DailyTargetDto })
  setDailyTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date', LocalDatePipe) date: string,
    @Body() dto: SetDailyTargetDto,
  ): Promise<DailyTargetDto> {
    return this.targetsService.setDailyTarget(user.id, date, dto);
  }

  @Delete(':date')
  @ApiOperation({ summary: 'Remove a single day override and fall back to the profile target' })
  @ApiOkResponse({ type: DailyTargetDto })
  clearDailyTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date', LocalDatePipe) date: string,
  ): Promise<DailyTargetDto> {
    return this.targetsService.clearDailyTarget(user.id, date);
  }
}
