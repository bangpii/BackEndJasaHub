import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { ContactModule } from './contact/contact.module';
import { DatabaseModule } from './database/database.module';
import { JasaModule } from './jasa/jasa.module';
import { PesananModule } from './pesanan/pesanan.module';
import { ProjectsModule } from './projects/projects.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RealtimeModule,
    AuthModule,
    AdminUsersModule,
    ProjectsModule,
    JasaModule,
    PesananModule,
    ChatModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
