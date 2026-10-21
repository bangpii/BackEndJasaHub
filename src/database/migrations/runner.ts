import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

/**
 * Runner migrasi sederhana untuk JasaHub.
 *
 * Cara pakai (manual):
 *   npm run migration        -> jalankan semua migrasi yang belum diterapkan
 *   npm run migration -- down -> rollback migrasi terakhir
 *
 * Setiap file migrasi mengekspor `up(client)` dan `down(client)`.
 * Riwayat migrasi dicatat di tabel `_migrations` sehingga idempoten.
 */

type Migration = {
  name: string;
  up: (client: import('pg').PoolClient) => Promise<void>;
  down?: (client: import('pg').PoolClient) => Promise<void>;
};

const MIGRATIONS_DIR = __dirname;

async function loadMigrations(): Promise<Migration[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const files = entries
    .filter((f) => /\.(js|ts)$/.test(f) && !f.endsWith('.d.ts'))
    .filter((f) => f !== 'index.js' && f !== 'index.ts' && f !== 'runner.js' && f !== 'runner.ts')
    .sort();

  const migrations: Migration[] = [];
  for (const file of files) {
    const mod = await import(join(MIGRATIONS_DIR, file));
    const migration: Migration = mod.default ?? mod;
    if (typeof migration.up !== 'function') {
      throw new Error(`Migrasi "${file}" tidak mengekspor fungsi up().`);
    }
    migrations.push({ ...migration, name: file.replace(/\.(js|ts)$/, '') });
  }
  return migrations;
}

async function ensureMigrationsTable(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(client: import('pg').PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ name: string }>('SELECT name FROM _migrations');
  return new Set(rows.map((r) => r.name));
}

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL belum di-set. Isi file .env di folder backend.');
  }

  const direction = process.argv.includes('down') ? 'down' : 'up';
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const migrations = await loadMigrations();

    if (direction === 'up') {
      const pending = migrations.filter((m) => !applied.has(m.name));
      if (pending.length === 0) {
        console.log('Tidak ada migrasi baru. Database sudah terbaru.');
        return;
      }
      for (const m of pending) {
        console.log(`>> Menerapkan: ${m.name}`);
        await client.query('BEGIN');
        try {
          await m.up(client);
          await client.query('INSERT INTO _migrations (name) VALUES ($1)', [m.name]);
          await client.query('COMMIT');
          console.log(`   OK: ${m.name}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`   GAGAL: ${m.name}`);
          throw err;
        }
      }
      console.log(`\nSelesai. ${pending.length} migrasi diterapkan.`);
    } else {
      const appliedList = migrations.filter((m) => applied.has(m.name));
      const last = appliedList[appliedList.length - 1];
      if (!last || typeof last.down !== 'function') {
        console.log('Tidak ada migrasi yang bisa di-rollback.');
        return;
      }
      console.log(`<< Rollback: ${last.name}`);
      await client.query('BEGIN');
      try {
        await last.down(client);
        await client.query('DELETE FROM _migrations WHERE name = $1', [last.name]);
        await client.query('COMMIT');
        console.log(`   OK: ${last.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\nMigrasi gagal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
