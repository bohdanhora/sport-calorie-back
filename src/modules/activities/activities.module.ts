import { Module } from '@nestjs/common';

import { ActivityEntriesController, ActivityTypesController } from './activities.controller';
import { ActivityEnergyService } from './activity-energy.service';
import { ActivityEntriesService } from './activity-entries.service';
import { ActivityTypesService } from './activity-types.service';

@Module({
  controllers: [ActivityTypesController, ActivityEntriesController],
  providers: [ActivityTypesService, ActivityEntriesService, ActivityEnergyService],
  exports: [ActivityEntriesService, ActivityEnergyService],
})
export class ActivitiesModule {}
