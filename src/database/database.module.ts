import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService, PG_POOL } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          throw new Error(
            'DATABASE_URL belum di-set. Isi file .env di folder backend.',
          );
        }
        return new Pool({
          connectionString,
          ssl: { rejectUnauthorized: false },
          max: 5,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        });
      },
    },
    DatabaseService,
  ],
  exports: [DatabaseService, PG_POOL],
})
export class DatabaseModule {}
