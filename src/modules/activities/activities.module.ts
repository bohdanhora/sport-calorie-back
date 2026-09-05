import { Module } from '@nestjs/common';

import { NutritionProviderModule } from '../nutrition-provider/nutrition-provider.module';

import { ActivityEntriesController, ActivityTypesController } from './activities.controller';
import { ActivityEnergyService } from './activity-energy.service';
import { ActivityEntriesService } from './activity-entries.service';
import { ActivityParsingService } from './activity-parsing.service';
import { ActivityTypesService } from './activity-types.service';

@Module({
  imports: [NutritionProviderModule],
  controllers: [ActivityTypesController, ActivityEntriesController],
  providers: [
    ActivityTypesService,
    ActivityEntriesService,
    ActivityEnergyService,
    ActivityParsingService,
  ],
  exports: [ActivityEntriesService, ActivityEnergyService],
})
export class ActivitiesModule {}
