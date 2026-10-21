import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { decryptIfNeeded, encryptIfNeeded } from '../common/crypto.util';
import { PG_POOL } from '../database/database.service';
import { DatabaseService } from '../database/database.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export type AccountRole = 'admin' | 'pelanggan';

export interface AdminAccountDto {
  id: number;
  no: number;
  userId: number;
  nama: string;
  email: string;
  jabatan: string | null;
  telepon: string | null;
  foto: string | null;
  isRoot: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PelangganAccountDto {
  id: number;
  no: number;
  userId: number;
  nama: string;
  email: string;
  telepon: string | null;
  alamat: string | null;
  kota: string | null;
  provinsi: string | null;
  kodePos: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SaveAdminInput {
  nama?: string;
  email?: string;
  password?: string;
  jabatan?: string | null;
  telepon?: string | null;
}

export interface SavePelangganInput {
  nama?: string;
  email?: string;
  password?: string;
  telepon?: string | null;
  alamat?: string | null;
  kota?: string | null;
  provinsi?: string | null;
  kodePos?: string | null;
}

const MAX_PAGE_SIZE = 50;

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ============================================================
  // ADMIN
  // ============================================================

  async listAdmins(page = 1, pageSize = 8, search = ''): Promise<PagedResult<AdminAccountDto>> {
    const { limit, offset, safePage } = this.paginate(page, pageSize);
    const term = `%${search.trim().toLowerCase()}%`;

    const totalRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM admin a JOIN users u ON u.id = a.user_id
       WHERE ($1 = '' OR LOWER(a.nama) LIKE $2 OR LOWER(u.email) LIKE $2)`,
      [search.trim(), term],
    );
    const total = Number(totalRows[0]?.count ?? 0);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT a.id, a.user_id, a.nama, a.jabatan, a.telepon_enc, a.foto,
              a.is_root, u.email, u.is_active, u.created_at
       FROM admin a JOIN users u ON u.id = a.user_id
       WHERE ($1 = '' OR LOWER(a.nama) LIKE $2 OR LOWER(u.email) LIKE $2)
       ORDER BY a.is_root DESC, a.id ASC
       LIMIT $3 OFFSET $4`,
      [search.trim(), term, limit, offset],
    );

    const items = rows.map((r, i) => ({
      id: Number(r.id),
      no: offset + i + 1,
      userId: Number(r.user_id),
      nama: String(r.nama),
      email: String(r.email),
      jabatan: (r.jabatan as string | null) ?? null,
      telepon: decryptIfNeeded(r.telepon_enc as string | null),
      foto: (r.foto as string | null) ?? null,
      isRoot: Boolean(r.is_root),
      isActive: Boolean(r.is_active),
      createdAt: new Date(r.created_at as string).toISOString(),
    }));

    return this.envelope(items, total, safePage, limit);
  }

  async createAdmin(input: SaveAdminInput): Promise<AdminAccountDto> {
    const nama = this.require(input.nama, 'Nama admin wajib diisi');
    const email = this.normalizeEmail(input.email);
    const password = this.require(input.password, 'Password wajib diisi');

    await this.assertEmailFree(email);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const userId = await this.insertUser(client, email, password, 'admin');
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO admin (user_id, nama, jabatan, telepon_enc, telepon)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING id`,
        [userId, nama, input.jabatan ?? null, encryptIfNeeded(input.telepon)],
      );
      await client.query('COMMIT');

      const created = await this.findAdminById(Number(rows[0].id));
      if (!created) throw new NotFoundException('Admin gagal dibuat');
      this.realtime.emitAccountsChanged({ action: 'admin:created' });
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateAdmin(id: number, input: SaveAdminInput): Promise<AdminAccountDto> {
    const current = await this.rawAdmin(id);
    if (!current) throw new NotFoundException('Admin tidak ditemukan');
    if (current.is_root) {
      throw new ForbiddenException({
        success: false,
        message: 'Admin root tidak dapat diedit.',
      });
    }

    const nama = this.require(input.nama, 'Nama admin wajib diisi');
    const email = this.normalizeEmail(input.email);
    await this.assertEmailFree(email, current.user_id);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [
        email,
        current.user_id,
      ]);
      if (input.password) {
        const password = this.require(input.password, 'Password tidak valid');
        const hash = await bcrypt.hash(password, 10);
        await client.query(
          'UPDATE users SET password = $1, password_enc = $2 WHERE id = $3',
          [hash, encryptIfNeeded(password), current.user_id],
        );
      }
      await client.query(
        `UPDATE admin SET nama = $1, jabatan = $2, telepon_enc = $3, updated_at = NOW()
         WHERE id = $4`,
        [nama, input.jabatan ?? null, encryptIfNeeded(input.telepon), id],
      );
      await client.query('COMMIT');

      const updated = await this.findAdminById(id);
      if (!updated) throw new NotFoundException('Admin gagal diperbarui');
      this.realtime.emitAccountsChanged({ action: 'admin:updated' });
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteAdmin(id: number): Promise<{ success: true }> {
    const current = await this.rawAdmin(id);
    if (!current) throw new NotFoundException('Admin tidak ditemukan');
    if (current.is_root) {
      throw new ForbiddenException({
        success: false,
        message: 'Admin root tidak dapat dihapus.',
      });
    }
    await this.db.query('DELETE FROM users WHERE id = $1', [current.user_id]);
    this.realtime.emitAccountsChanged({ action: 'admin:deleted' });
    return { success: true };
  }

  // ============================================================
  // PELANGGAN
  // ============================================================

  async listPelanggan(
    page = 1,
    pageSize = 8,
    search = '',
  ): Promise<PagedResult<PelangganAccountDto>> {
    const { limit, offset, safePage } = this.paginate(page, pageSize);
    const term = `%${search.trim().toLowerCase()}%`;

    const totalRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pelanggan p JOIN users u ON u.id = p.user_id
       WHERE ($1 = '' OR LOWER(p.nama) LIKE $2 OR LOWER(u.email) LIKE $2)`,
      [search.trim(), term],
    );
    const total = Number(totalRows[0]?.count ?? 0);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT p.id, p.user_id, p.nama, p.telepon_enc, p.alamat_enc, p.kota_enc,
              p.provinsi_enc, p.kode_pos_enc, u.email, u.is_active, u.created_at
       FROM pelanggan p JOIN users u ON u.id = p.user_id
       WHERE ($1 = '' OR LOWER(p.nama) LIKE $2 OR LOWER(u.email) LIKE $2)
       ORDER BY p.id ASC
       LIMIT $3 OFFSET $4`,
      [search.trim(), term, limit, offset],
    );

    const items = rows.map((r, i) => this.mapPelanggan(r, offset + i + 1));
    return this.envelope(items, total, safePage, limit);
  }

  async createPelanggan(input: SavePelangganInput): Promise<PelangganAccountDto> {
    const nama = this.require(input.nama, 'Nama pelanggan wajib diisi');
    const email = this.normalizeEmail(input.email);
    const password = this.require(input.password, 'Password wajib diisi');
    await this.assertEmailFree(email);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const userId = await this.insertUser(client, email, password, 'pelanggan');
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO pelanggan
           (user_id, nama, telepon_enc, alamat_enc, kota_enc, provinsi_enc, kode_pos_enc,
            telepon, alamat, kota, provinsi, kode_pos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NULL, NULL, NULL)
         RETURNING id`,
        [
          userId,
          nama,
          encryptIfNeeded(input.telepon),
          encryptIfNeeded(input.alamat),
          encryptIfNeeded(input.kota),
          encryptIfNeeded(input.provinsi),
          encryptIfNeeded(input.kodePos),
        ],
      );
      await client.query('COMMIT');

      const created = await this.findPelangganById(Number(rows[0].id));
      if (!created) throw new NotFoundException('Pelanggan gagal dibuat');
      this.realtime.emitAccountsChanged({ action: 'pelanggan:created' });
      return created;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updatePelanggan(id: number, input: SavePelangganInput): Promise<PelangganAccountDto> {
    const current = await this.rawPelanggan(id);
    if (!current) throw new NotFoundException('Pelanggan tidak ditemukan');

    const nama = this.require(input.nama, 'Nama pelanggan wajib diisi');
    const email = this.normalizeEmail(input.email);
    await this.assertEmailFree(email, current.user_id);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [
        email,
        current.user_id,
      ]);
      if (input.password) {
        const password = this.require(input.password, 'Password tidak valid');
        const hash = await bcrypt.hash(password, 10);
        await client.query(
          'UPDATE users SET password = $1, password_enc = $2 WHERE id = $3',
          [hash, encryptIfNeeded(password), current.user_id],
        );
      }
      await client.query(
        `UPDATE pelanggan
         SET nama = $1, telepon_enc = $2, alamat_enc = $3, kota_enc = $4,
             provinsi_enc = $5, kode_pos_enc = $6, updated_at = NOW()
         WHERE id = $7`,
        [
          nama,
          encryptIfNeeded(input.telepon),
          encryptIfNeeded(input.alamat),
          encryptIfNeeded(input.kota),
          encryptIfNeeded(input.provinsi),
          encryptIfNeeded(input.kodePos),
          id,
        ],
      );
      await client.query('COMMIT');

      const updated = await this.findPelangganById(id);
      if (!updated) throw new NotFoundException('Pelanggan gagal diperbarui');
      this.realtime.emitAccountsChanged({ action: 'pelanggan:updated' });
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deletePelanggan(id: number): Promise<{ success: true }> {
    const current = await this.rawPelanggan(id);
    if (!current) throw new NotFoundException('Pelanggan tidak ditemukan');
    await this.db.query('DELETE FROM users WHERE id = $1', [current.user_id]);
    this.realtime.emitAccountsChanged({ action: 'pelanggan:deleted' });
    return { success: true };
  }

  // ============================================================
  // REVEAL (data sensitif + password asli, setelah verifikasi password admin)
  // ============================================================

  async revealAdmin(id: number): Promise<Record<string, string | null>> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT a.nama, a.telepon_enc, u.email, u.password_enc
       FROM admin a JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Admin tidak ditemukan');
    return {
      nama: String(r.nama),
      email: String(r.email),
      telepon: decryptIfNeeded(r.telepon_enc as string | null),
      password: decryptIfNeeded(r.password_enc as string | null),
    };
  }

  async revealPelanggan(id: number): Promise<Record<string, string | null>> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT p.nama, p.telepon_enc, p.alamat_enc, p.kota_enc, p.provinsi_enc,
              p.kode_pos_enc, u.email, u.password_enc
       FROM pelanggan p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Pelanggan tidak ditemukan');
    return {
      nama: String(r.nama),
      email: String(r.email),
      telepon: decryptIfNeeded(r.telepon_enc as string | null),
      alamat: decryptIfNeeded(r.alamat_enc as string | null),
      kota: decryptIfNeeded(r.kota_enc as string | null),
      provinsi: decryptIfNeeded(r.provinsi_enc as string | null),
      kodePos: decryptIfNeeded(r.kode_pos_enc as string | null),
      password: decryptIfNeeded(r.password_enc as string | null),
    };
  }

  // ============================================================

  private async findAdminById(id: number): Promise<AdminAccountDto | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT a.id, a.user_id, a.nama, a.jabatan, a.telepon_enc, a.foto,
              a.is_root, u.email, u.is_active, u.created_at
       FROM admin a JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: Number(r.id),
      no: 0,
      userId: Number(r.user_id),
      nama: String(r.nama),
      email: String(r.email),
      jabatan: (r.jabatan as string | null) ?? null,
      telepon: decryptIfNeeded(r.telepon_enc as string | null),
      foto: (r.foto as string | null) ?? null,
      isRoot: Boolean(r.is_root),
      isActive: Boolean(r.is_active),
      createdAt: new Date(r.created_at as string).toISOString(),
    };
  }

  private async findPelangganById(id: number): Promise<PelangganAccountDto | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT p.id, p.user_id, p.nama, p.telepon_enc, p.alamat_enc, p.kota_enc,
              p.provinsi_enc, p.kode_pos_enc, u.email, u.is_active, u.created_at
       FROM pelanggan p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
      [id],
    );
    const r = rows[0];
    return r ? this.mapPelanggan(r, 0) : null;
  }

  private mapPelanggan(r: Record<string, unknown>, no: number): PelangganAccountDto {
    return {
      id: Number(r.id),
      no,
      userId: Number(r.user_id),
      nama: String(r.nama),
      email: String(r.email),
      telepon: decryptIfNeeded(r.telepon_enc as string | null),
      alamat: decryptIfNeeded(r.alamat_enc as string | null),
      kota: decryptIfNeeded(r.kota_enc as string | null),
      provinsi: decryptIfNeeded(r.provinsi_enc as string | null),
      kodePos: decryptIfNeeded(r.kode_pos_enc as string | null),
      isActive: Boolean(r.is_active),
      createdAt: new Date(r.created_at as string).toISOString(),
    };
  }

  private async rawAdmin(id: number): Promise<{ user_id: number; is_root: boolean } | null> {
    const rows = await this.db.query<{ user_id: string; is_root: boolean }>(
      'SELECT user_id, is_root FROM admin WHERE id = $1',
      [id],
    );
    const r = rows[0];
    return r ? { user_id: Number(r.user_id), is_root: Boolean(r.is_root) } : null;
  }

  private async rawPelanggan(id: number): Promise<{ user_id: number } | null> {
    const rows = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM pelanggan WHERE id = $1',
      [id],
    );
    const r = rows[0];
    return r ? { user_id: Number(r.user_id) } : null;
  }

  private async insertUser(
    client: import('pg').PoolClient,
    email: string,
    password: string,
    role: AccountRole,
  ): Promise<number> {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password, password_enc, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [email, hash, encryptIfNeeded(password), role],
    );
    return Number(rows[0].id);
  }

  private async assertEmailFree(email: string, exceptUserId?: number): Promise<void> {
    const rows = await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    const existing = rows[0];
    if (existing && Number(existing.id) !== exceptUserId) {
      throw new ConflictException({
        success: false,
        message: 'Email sudah terdaftar. Gunakan email lain.',
      });
    }
  }

  private require(value: string | undefined, message: string): string {
    if (!value || !value.trim()) {
      throw new BadRequestException({ success: false, message });
    }
    return value.trim();
  }

  private normalizeEmail(email: string | undefined): string {
    const value = this.require(email, 'Email wajib diisi').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new BadRequestException({ success: false, message: 'Format email tidak valid' });
    }
    return value;
  }

  private paginate(page: number, pageSize: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const limit =
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), MAX_PAGE_SIZE)
        : 8;
    return { limit, offset: (safePage - 1) * limit, safePage };
  }

  private envelope<T>(items: T[], total: number, page: number, pageSize: number): PagedResult<T> {
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
