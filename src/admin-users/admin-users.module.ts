import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AdminGuard],
})
export class AdminUsersModule {}
