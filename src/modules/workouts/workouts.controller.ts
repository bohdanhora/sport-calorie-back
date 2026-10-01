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
import { DateRangeQueryDto } from '../../common/dto/date-query.dto';
import { addLocalDays } from '../../common/date/local-date';
import { ActivityEntryDto } from '../activities/dto/activity-entry-response.dto';
import { UserContextService } from '../user-context/user-context.service';
import { CalendarDto, CreatePlanDto, PlanDto, UpdatePlanDto } from './dto/plan.dto';
import {
  CreateSavedExerciseDto,
  LogTemplateDto,
  SavedExerciseDto,
  UpdateSavedExerciseDto,
} from './dto/saved-exercise.dto';
import { CreateWorkoutDto, UpdateWorkoutDto, WorkoutDto } from './dto/workout.dto';
import { PlansService } from './plans.service';
import { SavedExercisesService } from './saved-exercises.service';
import { WorkoutsService } from './workouts.service';

const DEFAULT_CALENDAR_DAYS = 7;

@ApiTags('workouts')
@ApiBearerAuth()
@Controller('saved-exercises')
export class SavedExercisesController {
  constructor(private readonly savedExercises: SavedExercisesService) {}

  @Get()
  @ApiOperation({
    summary: 'Exercises saved for repeating, with an estimate at the current weight',
  })
  @ApiOkResponse({ type: [SavedExerciseDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<SavedExerciseDto[]> {
    return this.savedExercises.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save an exercise to repeat it later' })
  @ApiOkResponse({ type: SavedExerciseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedExerciseDto,
  ): Promise<SavedExerciseDto> {
    return this.savedExercises.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved exercise' })
  @ApiOkResponse({ type: SavedExerciseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedExerciseDto,
  ): Promise<SavedExerciseDto> {
    return this.savedExercises.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a saved exercise and take it out of every workout' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.savedExercises.remove(user.id, id);
  }

  @Post(':id/log')
  @ApiOperation({ summary: 'Log a saved exercise on a day' })
  @ApiOkResponse({ type: ActivityEntryDto })
  log(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogTemplateDto,
  ): Promise<ActivityEntryDto> {
    return this.savedExercises.log(user.id, id, dto.date);
  }
}

@ApiTags('workouts')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get()
  @ApiOperation({ summary: 'Saved workouts with their exercises and total calories' })
  @ApiOkResponse({ type: [WorkoutDto] })
  list(@CurrentUser() user: AuthenticatedUser): Promise<WorkoutDto[]> {
    return this.workouts.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Group saved exercises into a workout' })
  @ApiOkResponse({ type: WorkoutDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkoutDto,
  ): Promise<WorkoutDto> {
    return this.workouts.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a workout or change its exercises' })
  @ApiOkResponse({ type: WorkoutDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutDto,
  ): Promise<WorkoutDto> {
    return this.workouts.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a workout, its exercises stay saved' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workouts.remove(user.id, id);
  }

  @Post(':id/log')
  @ApiOperation({ summary: 'Log every exercise of a workout on a day' })
  @ApiOkResponse({ type: [ActivityEntryDto] })
  log(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogTemplateDto,
  ): Promise<ActivityEntryDto[]> {
    return this.workouts.log(user.id, id, dto.date);
  }
}

@ApiTags('workouts')
@ApiBearerAuth()
@Controller()
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly userContext: UserContextService,
  ) {}

  @Get('calendar')
  @ApiOperation({
    summary: 'Plans and logged activities for a range of days',
    description: 'Defaults to the seven days starting today in the user timezone.',
  })
  @ApiOkResponse({ type: CalendarDto })
  async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ): Promise<CalendarDto> {
    const from = query.from ?? (await this.userContext.resolveDate(user.id));
    const to = query.to ?? addLocalDays(from, DEFAULT_CALENDAR_DAYS - 1);

    return this.plans.calendar(user.id, from, to);
  }

  @Post('plans')
  @ApiOperation({ summary: 'Plan a workout, a saved exercise or a one-off activity on a day' })
  @ApiOkResponse({ type: PlanDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlanDto): Promise<PlanDto> {
    return this.plans.create(user.id, dto);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Move a plan to another day or place, or change a one-off activity' })
  @ApiOkResponse({ type: PlanDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanDto> {
    return this.plans.update(user.id, id, dto);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a plan, anything it already logged stays in the diary' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.plans.remove(user.id, id);
  }

  @Post('plans/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a plan done and log its activities on its day' })
  @ApiOkResponse({ type: PlanDto })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanDto> {
    return this.plans.complete(user.id, id);
  }

  @Post('plans/:id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo a done plan and remove the activities it logged' })
  @ApiOkResponse({ type: PlanDto })
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanDto> {
    return this.plans.reopen(user.id, id);
  }
}
