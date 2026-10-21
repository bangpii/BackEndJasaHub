import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../admin-users/admin.guard';
import { ProjectsService, SaveProjectInput } from './projects.service';

/** Katalog publik (halaman pelanggan / About). */
@Controller('api/projects')
export class PublicProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('all') all?: string,
  ) {
    // `all=true` mengembalikan seluruh project aktif (dipakai ring di About).
    if (all === 'true' || all === '1') {
      return this.projects.listActive();
    }
    return this.projects.list(Number(page) || 1, Number(pageSize) || 24, search ?? '');
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.projects.findBySlug(slug);
  }
}

/** CMS admin: kelola katalog project. */
@Controller('api/admin/projects')
@UseGuards(AdminGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.projects.list(Number(page) || 1, Number(pageSize) || 9, search ?? '');
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projects.findById(id);
  }

  @Post()
  create(@Body() body: SaveProjectInput) {
    return this.projects.create(body ?? {});
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveProjectInput) {
    return this.projects.update(id, body ?? {});
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projects.delete(id);
  }
}
