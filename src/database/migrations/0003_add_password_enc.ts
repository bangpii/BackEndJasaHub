import type { PoolClient } from 'pg';

/**
 * 0003_add_password_enc
 *
 * Menambah kolom `password_enc` di tabel `users` untuk menyimpan salinan
 * password yang dapat dibuka (AES-256-GCM). Kolom `password` tetap menyimpan
 * hash bcrypt untuk login.
 *
 * Catatan: password lama (sebelum fitur ini) hanya tersimpan sebagai hash
 * bcrypt sehingga TIDAK dapat diisi ulang di sini. Kolom ini akan terisi
 * otomatis saat akun dibuat/diperbarui setelah migrasi ini.
 */
export default {
  async up(client: PoolClient): Promise<void> {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_enc TEXT`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('ALTER TABLE users DROP COLUMN IF EXISTS password_enc');
  },
};
