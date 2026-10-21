import { Module } from '@nestjs/common';
import { AdminGuard } from '../admin-users/admin.guard';
import { JasaController, PublicJasaController } from './jasa.controller';
import { JasaService } from './jasa.service';

@Module({
  controllers: [PublicJasaController, JasaController],
  providers: [JasaService, AdminGuard],
})
export class JasaModule {}
