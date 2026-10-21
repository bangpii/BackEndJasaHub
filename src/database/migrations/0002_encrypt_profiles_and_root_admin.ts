import type { PoolClient } from 'pg';
import { encryptField } from '../../common/crypto.util';

/**
 * 0002_encrypt_profiles_and_root_admin
 *
 * 1. Menambah kolom `is_root` di tabel `admin` untuk menandai admin root
 *    (tidak bisa diedit/dihapus), lalu menandai admin pertama sebagai root.
 * 2. Mengenkripsi biodata sensitif (telepon, alamat, kota, provinsi, kode_pos)
 *    di tabel `pelanggan` dan `admin` ke kolom `*_enc` memakai AES-256-GCM,
 *    kemudian mengosongkan kolom plaintext.
 */
export default {
  async up(client: PoolClient): Promise<void> {
    // 1. is_root di admin
    await client.query(`
      ALTER TABLE admin
      ADD COLUMN IF NOT EXISTS is_root BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      UPDATE admin SET is_root = TRUE
      WHERE id = (SELECT id FROM admin ORDER BY id ASC LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM admin WHERE is_root = TRUE)
    `);

    // 2. kolom terenkripsi pelanggan
    await client.query(`ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS telepon_enc TEXT`);
    await client.query(`ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS alamat_enc TEXT`);
    await client.query(`ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS kota_enc TEXT`);
    await client.query(`ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS provinsi_enc TEXT`);
    await client.query(`ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS kode_pos_enc TEXT`);

    // 3. kolom terenkripsi admin
    await client.query(`ALTER TABLE admin ADD COLUMN IF NOT EXISTS telepon_enc TEXT`);

    // 4. migrasikan data lama -> terenkripsi, lalu kosongkan plaintext
    await encryptColumn(client, 'pelanggan', 'telepon');
    await encryptColumn(client, 'pelanggan', 'alamat');
    await encryptColumn(client, 'pelanggan', 'kota');
    await encryptColumn(client, 'pelanggan', 'provinsi');
    await encryptColumn(client, 'pelanggan', 'kode_pos');
    await encryptColumn(client, 'admin', 'telepon');
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('ALTER TABLE pelanggan DROP COLUMN IF EXISTS telepon_enc');
    await client.query('ALTER TABLE pelanggan DROP COLUMN IF EXISTS alamat_enc');
    await client.query('ALTER TABLE pelanggan DROP COLUMN IF EXISTS kota_enc');
    await client.query('ALTER TABLE pelanggan DROP COLUMN IF EXISTS provinsi_enc');
    await client.query('ALTER TABLE pelanggan DROP COLUMN IF EXISTS kode_pos_enc');
    await client.query('ALTER TABLE admin DROP COLUMN IF EXISTS telepon_enc');
    await client.query('ALTER TABLE admin DROP COLUMN IF EXISTS is_root');
  },
};

async function encryptColumn(
  client: PoolClient,
  table: string,
  column: string,
): Promise<void> {
  const { rows } = await client.query<{ id: string; value: string | null }>(
    `SELECT id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL AND ${column} <> ''`,
  );
  for (const row of rows) {
    const encrypted = encryptField(row.value as string);
    await client.query(
      `UPDATE ${table} SET ${column}_enc = $1, ${column} = NULL WHERE id = $2`,
      [encrypted, row.id],
    );
  }
}
