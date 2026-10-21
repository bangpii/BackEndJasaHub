import type { PoolClient } from 'pg';

/**
 * 0001_init_users_profiles
 *
 * Membuat tabel inti autentikasi & biodata:
 *  - users      : kredensial login (email + password hash)
 *  - pelanggan  : biodata pelanggan, 1-1 dengan users
 *  - admin      : biodata admin,      1-1 dengan users
 */
export default {
  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          BIGSERIAL PRIMARY KEY,
        email       VARCHAR(255) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(20)  NOT NULL DEFAULT 'pelanggan'
                    CHECK (role IN ('pelanggan', 'admin')),
        is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pelanggan (
        id          BIGSERIAL PRIMARY KEY,
        user_id     BIGINT NOT NULL UNIQUE
                    REFERENCES users(id) ON DELETE CASCADE,
        nama        VARCHAR(150) NOT NULL,
        telepon     VARCHAR(30),
        alamat      TEXT,
        kota        VARCHAR(100),
        provinsi    VARCHAR(100),
        kode_pos    VARCHAR(10),
        foto        VARCHAR(255),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id          BIGSERIAL PRIMARY KEY,
        user_id     BIGINT NOT NULL UNIQUE
                    REFERENCES users(id) ON DELETE CASCADE,
        nama        VARCHAR(150) NOT NULL,
        jabatan     VARCHAR(100),
        telepon     VARCHAR(30),
        foto        VARCHAR(255),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pelanggan_user_id ON pelanggan (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_admin_user_id ON admin (user_id)`);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS admin');
    await client.query('DROP TABLE IF EXISTS pelanggan');
    await client.query('DROP TABLE IF EXISTS users');
  },
};
