import type { PoolClient } from 'pg';
import { SEED_PROJECTS } from '../seeds/projects.seed';

/**
 * 0004_create_projects
 *
 * Membuat tabel `projects` untuk katalog "Jasa Aktif" (portofolio jasa),
 * lalu mengisinya dengan data awal secara idempoten (berdasarkan `slug`).
 *
 * - description : JSONB { id, en } — deskripsi bilingual
 * - languages   : TEXT[] — daftar teknologi
 * - role        : JSONB { id, en } | NULL — peran kontribusi (opsional)
 */
export default {
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id          BIGSERIAL PRIMARY KEY,
        slug        VARCHAR(120) NOT NULL UNIQUE,
        name        VARCHAR(150) NOT NULL,
        image_src   TEXT,
        github      TEXT,
        url         TEXT,
        languages   TEXT[] NOT NULL DEFAULT '{}',
        role        JSONB,
        description JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug)`);

    let order = 0;
    for (const p of SEED_PROJECTS) {
      await client.query(
        `INSERT INTO projects
           (slug, name, image_src, github, url, languages, role, description, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (slug) DO NOTHING`,
        [
          p.slug,
          p.name,
          p.imageSrc,
          p.github,
          p.url,
          p.languages,
          p.role ? JSON.stringify(p.role) : null,
          JSON.stringify(p.description),
          order++,
        ],
      );
    }
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS projects');
  },
};
