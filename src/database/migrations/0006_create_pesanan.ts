import type { PoolClient } from 'pg';

/**
 * 0006_create_pesanan
 *
 * Membuat tabel `pesanan` untuk pesanan jasa dari halaman pelanggan
 * (section "Jasa Kami" → tombol "Pesan Sekarang").
 *
 * Kolom:
 *  - jasa_id        : relasi ke tabel `jasa` (nullable bila jasa dihapus)
 *  - jasa_slug      : snapshot slug jasa saat dipesan (untuk riwayat)
 *  - nama_lengkap   : nama lengkap pemesan
 *  - alamat         : alamat lengkap pemesan
 *  - nomor_wa       : nomor WhatsApp pemesan (ternormalisasi, mis. 62812xxxx)
 *  - jenis_jasa     : judul/tipe jasa yang dipesan (teks bebas, snapshot)
 *  - status         : status pesanan (baru, diproses, selesai, batal)
 *  - wa_sent        : flag apakah admin sudah mengirim pesan WA ke pelanggan
 *  - wa_sent_at     : waktu pesan WA dikirim admin
 *  - is_processed   : flag apakah pesanan sudah ditangani admin
 *  - catatan        : catatan tambahan (opsional)
 */
export default {
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pesanan (
        id            BIGSERIAL PRIMARY KEY,
        jasa_id       BIGINT REFERENCES jasa(id) ON DELETE SET NULL,
        jasa_slug     VARCHAR(120),
        nama_lengkap  VARCHAR(150) NOT NULL,
        alamat        TEXT,
        nomor_wa      VARCHAR(30) NOT NULL,
        jenis_jasa    VARCHAR(150) NOT NULL,
        status        VARCHAR(20) NOT NULL DEFAULT 'baru'
                      CHECK (status IN ('baru', 'diproses', 'selesai', 'batal')),
        wa_sent       BOOLEAN NOT NULL DEFAULT FALSE,
        wa_sent_at    TIMESTAMPTZ,
        is_processed  BOOLEAN NOT NULL DEFAULT FALSE,
        catatan       TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesanan_jasa_id ON pesanan (jasa_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesanan_nomor_wa ON pesanan (nomor_wa)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesanan_status ON pesanan (status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pesanan_created_at ON pesanan (created_at DESC)`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS pesanan');
  },
};
