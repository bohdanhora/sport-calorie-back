import { Module } from '@nestjs/common';

import { FoodParsingService } from './food-parsing.service';
import { NutritionProviderController } from './nutrition-provider.controller';
import { NutritionProviderService } from './nutrition-provider.service';
import { ProviderChatService } from './provider-chat.service';

@Module({
  controllers: [NutritionProviderController],
  providers: [NutritionProviderService, FoodParsingService, ProviderChatService],
  exports: [NutritionProviderService, FoodParsingService, ProviderChatService],
})
export class NutritionProviderModule {}
