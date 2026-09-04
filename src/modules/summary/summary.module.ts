import { Module } from '@nestjs/common';

import { ActivitiesModule } from '../activities/activities.module';
import { FoodEntriesModule } from '../food-entries/food-entries.module';
import { TargetsModule } from '../targets/targets.module';
import { WeightModule } from '../weight/weight.module';
import { DailySummaryService } from './daily-summary.service';
import { ProgressService } from './progress.service';
import { SummaryController } from './summary.controller';

@Module({
  imports: [TargetsModule, FoodEntriesModule, ActivitiesModule, WeightModule],
  controllers: [SummaryController],
  providers: [DailySummaryService, ProgressService],
  exports: [DailySummaryService, ProgressService],
})
export class SummaryModule {}
