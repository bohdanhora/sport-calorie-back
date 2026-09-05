import { Module } from '@nestjs/common';

import { TargetsModule } from '../targets/targets.module';
import { WeightModule } from '../weight/weight.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TargetsModule, WeightModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
