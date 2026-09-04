import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ProfileDto } from './dto/profile-response.dto';
import { UpdateCalorieTargetDto } from './dto/update-calorie-target.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Profile, preferences and the derived energy estimates' })
  @ApiOkResponse({ type: ProfileDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<ProfileDto> {
    return this.profileService.get(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update personal data and preferences' })
  @ApiOkResponse({ type: ProfileDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDto> {
    return this.profileService.update(user.id, dto);
  }

  @Put('calorie-target')
  @ApiOperation({
    summary: 'Set or clear the manual calorie target',
    description: 'Sending null restores the recommended target derived from BMR and TDEE.',
  })
  @ApiOkResponse({ type: ProfileDto })
  updateCalorieTarget(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCalorieTargetDto,
  ): Promise<ProfileDto> {
    return this.profileService.updateCalorieTarget(user.id, dto);
  }
}
