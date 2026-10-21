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
import { JasaService, SaveJasaInput } from './jasa.service';

/** Katalog publik "Jasa Kami". */
@Controller('api/jasa')
export class PublicJasaController {
  constructor(private readonly jasa: JasaService) {}

  @Get()
  list(@Query('all') all?: string) {
    if (all === 'true' || all === '1') {
      return this.jasa.listActive();
    }
    return this.jasa.list();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.jasa.findBySlug(slug);
  }
}

/** CMS admin: kelola katalog jasa. */
@Controller('api/admin/jasa')
@UseGuards(AdminGuard)
export class JasaController {
  constructor(private readonly jasa: JasaService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.jasa.list(Number(page) || 1, Number(pageSize) || 9, search ?? '');
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jasa.findById(id);
  }

  @Post()
  create(@Body() body: SaveJasaInput) {
    return this.jasa.create(body ?? {});
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveJasaInput) {
    return this.jasa.update(id, body ?? {});
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.jasa.delete(id);
  }
}
