import { Module } from '@nestjs/common';

import { FoodsModule } from '../foods/foods.module';
import { NutritionProviderModule } from '../nutrition-provider/nutrition-provider.module';
import { FoodEntriesController } from './food-entries.controller';
import { FoodEntriesService } from './food-entries.service';

@Module({
  imports: [FoodsModule, NutritionProviderModule],
  controllers: [FoodEntriesController],
  providers: [FoodEntriesService],
  exports: [FoodEntriesService],
})
export class FoodEntriesModule {}
