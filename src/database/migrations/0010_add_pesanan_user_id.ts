import type { PoolClient } from 'pg';

/**
 * 0010_add_pesanan_user_id
 *
 * Menghubungkan pesanan dengan akun pelanggan yang sedang login
 * agar fitur "Proses Pesanan" (timeline realtime) bisa menampilkan
 * pesanan milik pelanggan tersebut.
 *
 * Kolom:
 *  - user_id : nullable — pesanan lama/tamu tetap NULL (tidak merusak data).
 */
export default {
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      ALTER TABLE pesanan
        ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE SET NULL
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesanan_user_id ON pesanan (user_id)`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DROP INDEX IF EXISTS idx_pesanan_user_id`);
    await client.query(`ALTER TABLE pesanan DROP COLUMN IF EXISTS user_id`);
  },
};
