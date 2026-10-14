import { Module } from '@nestjs/common';

import { NutritionProviderModule } from '../nutrition-provider/nutrition-provider.module';
import { SummaryModule } from '../summary/summary.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [NutritionProviderModule, SummaryModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
