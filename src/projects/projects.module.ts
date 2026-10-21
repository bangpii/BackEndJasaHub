import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin-users/admin.guard';
import {
  ProjectsController,
  PublicProjectsController,
} from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [PublicProjectsController, ProjectsController],
  providers: [ProjectsService, AdminGuard],
})
export class ProjectsModule {}
