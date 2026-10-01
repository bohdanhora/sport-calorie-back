import { Module } from '@nestjs/common';

import { ActivitiesModule } from '../activities/activities.module';

import {
  PlansController,
  SavedExercisesController,
  WorkoutsController,
} from './workouts.controller';
import { PlansService } from './plans.service';
import { SavedExercisesService } from './saved-exercises.service';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [ActivitiesModule],
  controllers: [SavedExercisesController, WorkoutsController, PlansController],
  providers: [SavedExercisesService, WorkoutsService, PlansService],
})
export class WorkoutsModule {}
