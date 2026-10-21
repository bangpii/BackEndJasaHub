import type { PoolClient } from 'pg';
import { SEED_JASA } from '../seeds/jasa.seed';

/**
 * 0005_create_jasa
 *
 * Membuat tabel `jasa` untuk katalog "Jasa Kami" (paket layanan),
 * lalu mengisinya dengan data awal secara idempoten (berdasarkan `slug`).
 *
 * - title       : JSONB { id, en } — judul bilingual
 * - description : JSONB { id, en } — deskripsi bilingual
 * - features    : JSONB[] — daftar fitur bilingual { id, en }
 * - price       : TEXT — harga dasar (string, mis. "500000")
 */
export default {
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS jasa (
        id          BIGSERIAL PRIMARY KEY,
        slug        VARCHAR(120) NOT NULL UNIQUE,
        title       JSONB NOT NULL DEFAULT '{}'::jsonb,
        price       VARCHAR(40) NOT NULL DEFAULT '0',
        description JSONB NOT NULL DEFAULT '{}'::jsonb,
        features    JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_jasa_slug ON jasa (slug)`);

    let order = 0;
    for (const s of SEED_JASA) {
      await client.query(
        `INSERT INTO jasa
           (slug, title, price, description, features, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO NOTHING`,
        [
          s.slug,
          JSON.stringify(s.title),
          s.price,
          JSON.stringify(s.description),
          JSON.stringify(s.features),
          order++,
        ],
      );
    }
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS jasa');
  },
};
