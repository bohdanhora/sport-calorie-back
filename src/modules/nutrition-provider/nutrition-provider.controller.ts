import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { FoodParsingService } from './food-parsing.service';
import {
  NutritionProviderCheckDto,
  NutritionProviderDto,
  SaveNutritionProviderDto,
} from './dto/nutrition-provider.dto';
import { NutritionProviderService } from './nutrition-provider.service';

const CHECK_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('nutrition-provider')
@ApiBearerAuth()
@Controller('nutrition-provider')
export class NutritionProviderController {
  constructor(
    private readonly providerService: NutritionProviderService,
    private readonly parsingService: FoodParsingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current provider configuration with a masked key' })
  @ApiOkResponse({ type: NutritionProviderDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<NutritionProviderDto> {
    return this.providerService.get(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Store the provider configuration and encrypt the key' })
  @ApiOkResponse({ type: NutritionProviderDto })
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveNutritionProviderDto,
  ): Promise<NutritionProviderDto> {
    return this.providerService.save(user.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the stored provider configuration and key' })
  remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.providerService.remove(user.id);
  }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @Throttle(CHECK_THROTTLE)
  @ApiOperation({ summary: 'Send one test request to confirm the provider works' })
  @ApiOkResponse({ type: NutritionProviderCheckDto })
  async check(@CurrentUser() user: AuthenticatedUser): Promise<NutritionProviderCheckDto> {
    const credentials = await this.providerService.getCredentials(user.id);

    try {
      await this.parsingService.check(credentials);
      return { ok: true, message: null };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : null };
    }
  }
}
