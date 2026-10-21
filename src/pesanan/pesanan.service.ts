import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { Pool } from 'pg';
import { decryptIfNeeded, encryptIfNeeded } from '../common/crypto.util';
import { PG_POOL, DatabaseService } from '../database/database.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export type PesananStatus = 'baru' | 'diproses' | 'selesai' | 'batal';

export interface PesananAccount {
  email: string;
  password: string;
}

export interface CreatePesananResult extends PesananDto {
  account: PesananAccount | null;
}

export interface PesananDto {
  id: number;
  no: number;
  jasaId: number | null;
  jasaSlug: string | null;
  userId: number | null;
  namaLengkap: string;
  alamat: string | null;
  nomorWa: string;
  jenisJasa: string;
  status: PesananStatus;
  waSent: boolean;
  waSentAt: string | null;
  isProcessed: boolean;
  catatan: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePesananInput {
  namaLengkap?: string;
  alamat?: string | null;
  nomorWa?: string;
  jenisJasa?: string;
  jasaId?: number | string | null;
  jasaSlug?: string | null;
  catatan?: string | null;
  /** Diisi otomatis dari token bila pelanggan login (untuk fitur "Proses"). */
  userId?: number | string | null;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PesananStats {
  weekly: { label: string; date: string; count: number }[];
  monthly: { label: string; count: number }[];
  totals: { all: number; baru: number; diproses: number; selesai: number; waSent: number };
}

export interface DashboardSummary {
  counts: {
    pelanggan: number;
    admin: number;
    pesanan: number;
    pesananSebelumHariIni: number;
    jasaAktif: number;
    projectAktif: number;
  };
  status: { baru: number; diproses: number; selesai: number; batal: number };
  weekly: { label: string; count: number }[];
  jasa: { name: string; orders: number; share: number }[];
  recent: {
    id: number;
    namaLengkap: string;
    jenisJasa: string;
    status: PesananStatus;
    createdAt: string;
  }[];
}

const MAX_PAGE_SIZE = 50;
const STATUSES: PesananStatus[] = ['baru', 'diproses', 'selesai', 'batal'];

@Injectable()
export class PesananService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(page = 1, pageSize = 10, search = '', status = ''): Promise<PagedResult<PesananDto>> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const limit =
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), MAX_PAGE_SIZE)
        : 10;
    const offset = (safePage - 1) * limit;
    const term = `%${search.trim().toLowerCase()}%`;
    const statusFilter = STATUSES.includes(status as PesananStatus) ? status : '';

    const totalRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pesanan
       WHERE ($1 = '' OR $2 = '' OR LOWER(nama_lengkap) LIKE $3 OR LOWER(jenis_jasa) LIKE $3 OR nomor_wa LIKE $3)
         AND ($1 = '' OR status = $1)`,
      [statusFilter, search.trim(), term],
    );
    const total = Number(totalRows[0]?.count ?? 0);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM pesanan
       WHERE ($1 = '' OR $2 = '' OR LOWER(nama_lengkap) LIKE $3 OR LOWER(jenis_jasa) LIKE $3 OR nomor_wa LIKE $3)
         AND ($1 = '' OR status = $1)
       ORDER BY created_at DESC, id DESC
       LIMIT $4 OFFSET $5`,
      [statusFilter, search.trim(), term, limit, offset],
    );

    const items = rows.map((r, i) => this.map(r, offset + i + 1));
    return {
      items,
      total,
      page: safePage,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findById(id: number): Promise<PesananDto> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM pesanan WHERE id = $1',
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Pesanan tidak ditemukan');
    return this.map(rows[0], 0);
  }

  async create(input: CreatePesananInput): Promise<CreatePesananResult> {
    const namaLengkap = this.require(input.namaLengkap, 'Nama lengkap wajib diisi');
    const nomorWa = this.normalizeWa(input.nomorWa);
    const jenisJasa = this.require(input.jenisJasa, 'Jenis jasa wajib diisi');

    // Resolve relasi jasa dari jasa_id (atau dari slug) agar konsisten.
    let jasaId: number | null = null;
    let jasaSlug: string | null = this.nullable(input.jasaSlug);
    if (input.jasaId !== undefined && input.jasaId !== null && input.jasaId !== '') {
      const parsed = Number(input.jasaId);
      if (Number.isFinite(parsed)) {
        const found = await this.db.query<{ id: string; slug: string }>(
          'SELECT id, slug FROM jasa WHERE id = $1',
          [parsed],
        );
        if (found[0]) {
          jasaId = Number(found[0].id);
          jasaSlug = jasaSlug ?? found[0].slug;
        }
      }
    }

    // Login pelanggan → pakai akun itu. Tamu → akun pelanggan dibuat otomatis.
    let userId: number | null = null;
    if (input.userId !== undefined && input.userId !== null && input.userId !== '') {
      const parsed = Number(input.userId);
      if (Number.isFinite(parsed)) userId = parsed;
    }

    const alamat = this.nullable(input.alamat);
    const client = await this.pool.connect();
    let createdId = 0;
    let account: PesananAccount | null = null;
    let accountCreated = false;

    try {
      await client.query('BEGIN');

      if (userId === null) {
        const generated = await this.createPelangganAccount(
          client,
          namaLengkap,
          nomorWa,
          alamat,
        );
        userId = generated.userId;
        account = { email: generated.email, password: generated.password };
        accountCreated = true;
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO pesanan (jasa_id, jasa_slug, nama_lengkap, alamat, nomor_wa, jenis_jasa, catatan, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [jasaId, jasaSlug, namaLengkap, alamat, nomorWa, jenisJasa, this.nullable(input.catatan), userId],
      );
      createdId = Number(inserted.rows[0].id);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (accountCreated) this.realtime.emitAccountsChanged({ action: 'pelanggan:created' });
    this.realtime.emitPesananChanged({ action: 'created', id: createdId });
    const dto = await this.findById(createdId);
    return { ...dto, account };
  }

  /** Kredensial akun pelanggan yang terhubung ke sebuah pesanan (khusus admin). */
  async accountByPesanan(id: number): Promise<PesananAccount | null> {
    const rows = await this.db.query<{ email: string; password_enc: string | null }>(
      `SELECT u.email, u.password_enc
       FROM pesanan p JOIN users u ON u.id = p.user_id
       WHERE p.id = $1 AND u.role = 'pelanggan'`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    const password = decryptIfNeeded(row.password_enc);
    if (!password) return null;
    return { email: String(row.email), password };
  }

  /** Daftar pesanan milik pelanggan yang sedang login (fitur "Proses"). */
  async listMine(userId: number): Promise<PagedResult<PesananDto>> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM pesanan
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      [userId],
    );
    const items = rows.map((r, i) => this.map(r, i + 1));
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: Math.max(items.length, 1),
      totalPages: 1,
    };
  }

  async updateStatus(id: number, status: string): Promise<PesananDto> {
    if (!STATUSES.includes(status as PesananStatus)) {
      throw new BadRequestException({ success: false, message: 'Status pesanan tidak valid' });
    }
    const existing = await this.rawById(id);
    if (!existing) throw new NotFoundException('Pesanan tidak ditemukan');
    await this.db.query(
      `UPDATE pesanan SET status = $1, is_processed = $2, updated_at = NOW() WHERE id = $3`,
      [status, status !== 'baru', id],
    );
    this.realtime.emitPesananChanged({ action: 'status', id });
    return this.findById(id);
  }

  /** Tandai pesanan sudah/belum dikirimi pesan WhatsApp oleh admin. */
  async markWaSent(id: number, sent = true): Promise<PesananDto> {
    const existing = await this.rawById(id);
    if (!existing) throw new NotFoundException('Pesanan tidak ditemukan');
    await this.db.query(
      `UPDATE pesanan
       SET wa_sent = $1,
           wa_sent_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2`,
      [sent, id],
    );
    this.realtime.emitPesananChanged({ action: 'wa', id });
    return this.findById(id);
  }

  async delete(id: number): Promise<{ success: true }> {
    const existing = await this.rawById(id);
    if (!existing) throw new NotFoundException('Pesanan tidak ditemukan');
    await this.db.query('DELETE FROM pesanan WHERE id = $1', [id]);
    this.realtime.emitPesananChanged({ action: 'deleted', id });
    return { success: true };
  }

  /** Statistik: batang 7 hari terakhir + donut 1 bulan (per jenis jasa). */
  async stats(): Promise<PesananStats> {
    const weeklyRows = await this.db.query<{ day: string; count: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(p.id)::text AS count
       FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
       LEFT JOIN pesanan p ON p.created_at::date = d.day
       GROUP BY d.day
       ORDER BY d.day ASC`,
    );
    const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const weekly = weeklyRows.map((r) => ({
      date: r.day,
      label: dayLabels[new Date(`${r.day}T00:00:00`).getDay()],
      count: Number(r.count),
    }));

    const monthlyRows = await this.db.query<{ label: string; count: string }>(
      `SELECT COALESCE(NULLIF(jenis_jasa, ''), 'Lainnya') AS label, COUNT(*)::text AS count
       FROM pesanan
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY label
       ORDER BY COUNT(*) DESC`,
    );
    const monthly = monthlyRows.map((r) => ({ label: r.label, count: Number(r.count) }));

    const totalsRow = await this.db.query<{
      all: string;
      baru: string;
      diproses: string;
      selesai: string;
      wa_sent: string;
    }>(
      `SELECT
         COUNT(*)::text AS all,
         COUNT(*) FILTER (WHERE status = 'baru')::text AS baru,
         COUNT(*) FILTER (WHERE status = 'diproses')::text AS diproses,
         COUNT(*) FILTER (WHERE status = 'selesai')::text AS selesai,
         COUNT(*) FILTER (WHERE wa_sent = TRUE)::text AS wa_sent
       FROM pesanan`,
    );
    const t = totalsRow[0];
    const totals = {
      all: Number(t?.all ?? 0),
      baru: Number(t?.baru ?? 0),
      diproses: Number(t?.diproses ?? 0),
      selesai: Number(t?.selesai ?? 0),
      waSent: Number(t?.wa_sent ?? 0),
    };

    return { weekly, monthly, totals };
  }

  /**
   * Ringkasan dashboard admin — semua angka nyata dari database:
   * jumlah akun, pesanan, jasa aktif, project aktif, distribusi status,
   * pesanan 7 hari, pesanan per jasa, dan pesanan terbaru.
   */
  async dashboard(): Promise<DashboardSummary> {
    const countRows = await this.db.query<{
      pelanggan: string;
      admin: string;
      pesanan: string;
      pesanan_sebelum_hari_ini: string;
      jasa_aktif: string;
      project_aktif: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM pelanggan)::text AS pelanggan,
         (SELECT COUNT(*) FROM admin)::text AS admin,
         (SELECT COUNT(*) FROM pesanan)::text AS pesanan,
         (SELECT COUNT(*) FROM pesanan
           WHERE created_at AT TIME ZONE 'Asia/Jakarta'
                 < (NOW() AT TIME ZONE 'Asia/Jakarta')::date)::text AS pesanan_sebelum_hari_ini,
         (SELECT COUNT(*) FROM jasa WHERE is_active = TRUE)::text AS jasa_aktif,
         (SELECT COUNT(*) FROM projects WHERE is_active = TRUE)::text AS project_aktif`,
    );
    const c = countRows[0];
    const counts = {
      pelanggan: Number(c?.pelanggan ?? 0),
      admin: Number(c?.admin ?? 0),
      pesanan: Number(c?.pesanan ?? 0),
      pesananSebelumHariIni: Number(c?.pesanan_sebelum_hari_ini ?? 0),
      jasaAktif: Number(c?.jasa_aktif ?? 0),
      projectAktif: Number(c?.project_aktif ?? 0),
    };

    const statusRows = await this.db.query<{
      baru: string;
      diproses: string;
      selesai: string;
      batal: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'baru')::text AS baru,
         COUNT(*) FILTER (WHERE status = 'diproses')::text AS diproses,
         COUNT(*) FILTER (WHERE status = 'selesai')::text AS selesai,
         COUNT(*) FILTER (WHERE status = 'batal')::text AS batal
       FROM pesanan`,
    );
    const s = statusRows[0];
    const status = {
      baru: Number(s?.baru ?? 0),
      diproses: Number(s?.diproses ?? 0),
      selesai: Number(s?.selesai ?? 0),
      batal: Number(s?.batal ?? 0),
    };

    const weekRows = await this.db.query<{ day: string; count: string }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(p.id)::text AS count
       FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
       LEFT JOIN pesanan p ON p.created_at::date = d.day
       GROUP BY d.day
       ORDER BY d.day ASC`,
    );
    const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const weekly = weekRows.map((r) => ({
      label: dayLabels[new Date(`${r.day}T00:00:00`).getDay()],
      count: Number(r.count),
    }));

    const jasaRows = await this.db.query<{ title: unknown; orders: string }>(
      `SELECT j.title AS title, COUNT(p.id)::text AS orders
       FROM jasa j
       LEFT JOIN pesanan p ON p.jasa_id = j.id
       WHERE j.is_active = TRUE
       GROUP BY j.id, j.title, j.sort_order
       ORDER BY j.sort_order ASC, j.id ASC`,
    );
    const maxOrders = Math.max(1, ...jasaRows.map((r) => Number(r.orders)));
    const jasa = jasaRows.map((r) => {
      const title = (r.title as { id?: string; en?: string }) ?? {};
      return {
        name: title.id || title.en || '(Tanpa judul)',
        orders: Number(r.orders),
        share: Math.round((Number(r.orders) / maxOrders) * 100),
      };
    });

    const recentRows = await this.db.query<Record<string, unknown>>(
      `SELECT id, nama_lengkap, jenis_jasa, status, created_at
       FROM pesanan ORDER BY created_at DESC, id DESC LIMIT 5`,
    );
    const recent = recentRows.map((r) => ({
      id: Number(r.id),
      namaLengkap: String(r.nama_lengkap),
      jenisJasa: String(r.jenis_jasa),
      status: (r.status as PesananStatus) ?? 'baru',
      createdAt: new Date(r.created_at as string).toISOString(),
    }));

    return { counts, status, weekly, jasa, recent };
  }

  // ---------------- helpers ----------------

  private map(r: Record<string, unknown>, no: number): PesananDto {
    return {
      id: Number(r.id),
      no,
      jasaId: r.jasa_id === null || r.jasa_id === undefined ? null : Number(r.jasa_id),
      jasaSlug: (r.jasa_slug as string | null) ?? null,
      userId: r.user_id === null || r.user_id === undefined ? null : Number(r.user_id),
      namaLengkap: String(r.nama_lengkap),
      alamat: (r.alamat as string | null) ?? null,
      nomorWa: String(r.nomor_wa),
      jenisJasa: String(r.jenis_jasa),
      status: (r.status as PesananStatus) ?? 'baru',
      waSent: Boolean(r.wa_sent),
      waSentAt: r.wa_sent_at ? new Date(r.wa_sent_at as string).toISOString() : null,
      isProcessed: Boolean(r.is_processed),
      catatan: (r.catatan as string | null) ?? null,
      createdAt: new Date(r.created_at as string).toISOString(),
      updatedAt: r.updated_at
        ? new Date(r.updated_at as string).toISOString()
        : new Date(r.created_at as string).toISOString(),
    };
  }

  private async rawById(id: number): Promise<{ id: number } | null> {
    const rows = await this.db.query<{ id: string }>('SELECT id FROM pesanan WHERE id = $1', [id]);
    return rows[0] ? { id: Number(rows[0].id) } : null;
  }

  /**
   * Buat akun pelanggan otomatis dari data pemesanan:
   *  - email = slug nama + @jasahub.vercel.app (tambah angka bila sudah dipakai)
   *  - password = 8 karakter acak, dikembalikan sekali ke pemesan & admin.
   */
  private async createPelangganAccount(
    client: PoolClient,
    nama: string,
    telepon: string,
    alamat: string | null,
  ): Promise<{ userId: number; email: string; password: string }> {
    const base = this.emailSlug(nama);
    const domain = 'jasahub.vercel.app';
    let email = `${base}@${domain}`;
    let counter = 2;

    for (;;) {
      const taken = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
        email,
      ]);
      if (!taken.rows[0]) break;
      email = `${base}${counter}@${domain}`;
      counter += 1;
    }

    const password = this.generatePassword(8);
    const hash = await bcrypt.hash(password, 10);
    const userRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password, password_enc, role)
       VALUES ($1, $2, $3, 'pelanggan')
       RETURNING id`,
      [email, hash, encryptIfNeeded(password)],
    );
    const userId = Number(userRes.rows[0].id);

    await client.query(
      `INSERT INTO pelanggan (user_id, nama, telepon_enc, alamat_enc, telepon, alamat)
       VALUES ($1, $2, $3, $4, NULL, NULL)`,
      [userId, nama, encryptIfNeeded(telepon), encryptIfNeeded(alamat)],
    );

    return { userId, email, password };
  }

  private emailSlug(nama: string): string {
    const slug = nama
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
    return slug || `pelanggan${Date.now().toString(36)}`;
  }

  private generatePassword(length: number): string {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < length; i += 1) {
      password += alphabet[randomInt(alphabet.length)];
    }
    return password;
  }

  private require(value: string | undefined, message: string): string {
    if (!value || !value.trim()) throw new BadRequestException({ success: false, message });
    return value.trim();
  }

  private nullable(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  /** Normalisasi nomor WA Indonesia: 08xx / +628xx / 628xx -> 628xx. */
  private normalizeWa(raw: string | undefined): string {
    const digits = String(raw ?? '').replace(/[^\d]/g, '');
    if (!digits) throw new BadRequestException({ success: false, message: 'Nomor WA wajib diisi' });
    if (digits.startsWith('62')) return digits;
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
  }
}
