import type { PoolClient } from 'pg';

/**
 * Tabel penyimpanan pesan dari form Kontak.
 *
 * Setiap kiriman disimpan lebih dulu agar tidak hilang walau pengiriman
 * email gagal. Status pengiriman email dicatat di kolom `email_status`.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id           SERIAL PRIMARY KEY,
      nama         TEXT NOT NULL,
      telepon      TEXT NOT NULL,
      email        TEXT NOT NULL,
      pesan        TEXT NOT NULL,
      email_status TEXT NOT NULL DEFAULT 'pending'
                   CHECK (email_status IN ('pending', 'sent', 'failed')),
      email_error  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
      ON contact_messages (created_at DESC)
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query('DROP TABLE IF EXISTS contact_messages');
}

export default { up, down };
