import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Database');

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    const { rows } = await this.pool.query<{
      now: Date;
      version: string;
    }>('SELECT NOW() AS now, version() AS version');
    const host = (this.pool.options?.host as string | undefined) ?? 'unknown';
    this.logger.log(
      `Connected to Neon Postgres (${host}) — server time ${rows[0].now.toISOString()}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const run = () => this.pool.query(text, params).then((res) => res.rows as T[]);
    try {
      return await run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string }).code ?? '';
      const transient =
        code.startsWith('08') ||
        code === '57P01' ||
        /connection terminated|connection timeout|ECONNRESET|EPIPE/i.test(message);
      if (!transient) throw err;
      this.logger.warn(`Koneksi DB terputus, retry sekali: ${message}`);
      return await run();
    }
  }
}
