import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin-users/admin.guard';
import { PesananController, PublicPesananController } from './pesanan.controller';
import { PesananService } from './pesanan.service';

@Module({
  controllers: [PublicPesananController, PesananController],
  providers: [PesananService, AdminGuard],
})
export class PesananModule {}
