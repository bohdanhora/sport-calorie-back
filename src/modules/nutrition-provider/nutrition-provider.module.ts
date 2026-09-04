import { Module } from '@nestjs/common';

import { FoodParsingService } from './food-parsing.service';
import { NutritionProviderController } from './nutrition-provider.controller';
import { NutritionProviderService } from './nutrition-provider.service';

@Module({
  controllers: [NutritionProviderController],
  providers: [NutritionProviderService, FoodParsingService],
  exports: [NutritionProviderService, FoodParsingService],
})
export class NutritionProviderModule {}
