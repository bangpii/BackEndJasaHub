import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  getRoot() {
    return { message: 'API Backend JasaHub Ready' };
  }

  @Get('api/health/db')
  async getDbHealth() {
    const rows = await this.db.query<{ now: Date }>('SELECT NOW() AS now');
    return {
      status: 'Database Ready',
      database: 'Neon Postgres',
      serverTime: rows[0].now,
    };
  }
}
