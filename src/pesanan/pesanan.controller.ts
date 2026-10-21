import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../admin-users/admin.guard';
import {
  AuthedRequest,
  OptionalPelangganGuard,
  PelangganGuard,
} from './pelanggan.guard';
import { CreatePesananInput, PesananService } from './pesanan.service';

/** Endpoint publik: pelanggan membuat pesanan dari halaman "Jasa Kami". */
@Controller('api/pesanan')
export class PublicPesananController {
  constructor(private readonly pesanan: PesananService) {}

  @Post()
  @UseGuards(OptionalPelangganGuard)
  create(@Body() body: CreatePesananInput, @Req() req: AuthedRequest) {
    const userId = req.user?.sub ?? null;
    return this.pesanan.create({ ...(body ?? {}), userId });
  }

  /** Pesanan milik pelanggan yang sedang login (fitur "Proses"). */
  @Get('mine')
  @UseGuards(PelangganGuard)
  mine(@Req() req: AuthedRequest) {
    return this.pesanan.listMine(req.user!.sub);
  }
}

/** Endpoint admin: kelola daftar pesanan. */
@Controller('api/admin/pesanan')
@UseGuards(AdminGuard)
export class PesananController {
  constructor(private readonly pesanan: PesananService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.pesanan.list(Number(page) || 1, Number(pageSize) || 10, search ?? '', status ?? '');
  }

  @Get('stats')
  stats() {
    return this.pesanan.stats();
  }

  @Get('dashboard')
  dashboard() {
    return this.pesanan.dashboard();
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.pesanan.findById(id);
  }

  /** Kredensial akun pelanggan yang terhubung ke pesanan (untuk template WA). */
  @Get(':id/account')
  account(@Param('id', ParseIntPipe) id: number) {
    return this.pesanan.accountByPesanan(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string) {
    return this.pesanan.updateStatus(id, status);
  }

  @Patch(':id/wa-sent')
  markWaSent(@Param('id', ParseIntPipe) id: number, @Body('sent') sent?: boolean) {
    return this.pesanan.markWaSent(id, sent !== false);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pesanan.delete(id);
  }
}
