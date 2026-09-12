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
import { ActivityEntriesService } from './activity-entries.service';
import { ActivityParsingService } from './activity-parsing.service';
import { ActivityTypesService } from './activity-types.service';
import {
  CreateActivityEntryDto,
  EstimateActivityEnergyDto,
  UpdateActivityEntryDto,
} from './dto/activity-entry-request.dto';
import { ActivityEnergyEstimateDto, ActivityEntryDto } from './dto/activity-entry-response.dto';
import { ActivityTypeDto } from './dto/activity-type-response.dto';
import { ParseActivityDto, ParsedActivityDto } from './dto/parse-activity.dto';

const PARSE_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activity-types')
export class ActivityTypesController {
  constructor(private readonly activityTypes: ActivityTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Catalog of activities and the measurements each one supports' })
  @ApiOkResponse({ type: [ActivityTypeDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<ActivityTypeDto[]> {
    return this.activityTypes.list(user.id);
  }
}

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activity-entries')
export class ActivityEntriesController {
  constructor(
    private readonly activityEntries: ActivityEntriesService,
    private readonly activityParsing: ActivityParsingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Activities logged on a given day' })
  @ApiOkResponse({ type: [ActivityEntryDto] })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateQueryDto,
  ): Promise<ActivityEntryDto[]> {
    return this.activityEntries.listByDate(user.id, query.date);
  }

  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @Throttle(PARSE_THROTTLE)
  @ApiOperation({
    summary: 'Turn a described workout into form fields using the configured provider',
    description:
      'The provider picks the activity and the quantities; the energy is still calculated here. Nothing is logged until the user saves it.',
  })
  @ApiOkResponse({ type: ParsedActivityDto })
  parse(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ParseActivityDto,
  ): Promise<ParsedActivityDto> {
    return this.activityParsing.parse(user.id, dto);
  }

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview the estimated energy for an activity without saving it',
    description: 'The estimate uses the MET model and the most recent recorded body weight.',
  })
  @ApiOkResponse({ type: ActivityEnergyEstimateDto })
  estimate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EstimateActivityEnergyDto,
  ): Promise<ActivityEnergyEstimateDto> {
    return this.activityEntries.estimate(user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Log an activity' })
  @ApiOkResponse({ type: ActivityEntryDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateActivityEntryDto,
  ): Promise<ActivityEntryDto> {
    return this.activityEntries.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a logged activity' })
  @ApiOkResponse({ type: ActivityEntryDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityEntryDto,
  ): Promise<ActivityEntryDto> {
    return this.activityEntries.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a logged activity' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.activityEntries.remove(user.id, id);
  }
}
