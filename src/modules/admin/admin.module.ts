import { Module } from '@nestjs/common';

import { AdminKeyGuard } from './admin-key.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminKeyGuard],
})
export class AdminModule {}
