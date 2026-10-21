import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL, DatabaseService } from '../database/database.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface JasaDto {
  id: number;
  no: number;
  slug: string;
  title: { id: string; en: string };
  price: string;
  description: { id: string; en: string };
  features: { id: string; en: string }[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface SaveJasaInput {
  slug?: string;
  title?: { id?: string; en?: string };
  price?: string | number;
  description?: { id?: string; en?: string };
  features?: { id?: string; en?: string }[] | string;
  isActive?: boolean;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 50;

@Injectable()
export class JasaService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(page = 1, pageSize = 9, search = ''): Promise<PagedResult<JasaDto>> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const limit =
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), MAX_PAGE_SIZE)
        : 9;
    const offset = (safePage - 1) * limit;
    const term = `%${search.trim().toLowerCase()}%`;

    const totalRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM jasa
       WHERE ($1 = '' OR LOWER(title->>'id') LIKE $2 OR LOWER(title->>'en') LIKE $2 OR LOWER(slug) LIKE $2)`,
      [search.trim(), term],
    );
    const total = Number(totalRows[0]?.count ?? 0);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM jasa
       WHERE ($1 = '' OR LOWER(title->>'id') LIKE $2 OR LOWER(title->>'en') LIKE $2 OR LOWER(slug) LIKE $2)
       ORDER BY is_active DESC, sort_order ASC, id ASC
       LIMIT $3 OFFSET $4`,
      [search.trim(), term, limit, offset],
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

  async findById(id: number): Promise<JasaDto> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM jasa WHERE id = $1',
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Jasa tidak ditemukan');
    return this.map(rows[0], 0);
  }

  async findBySlug(slug: string): Promise<JasaDto> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM jasa WHERE slug = $1',
      [slug],
    );
    if (!rows[0]) throw new NotFoundException('Jasa tidak ditemukan');
    return this.map(rows[0], 0);
  }

  /** Semua jasa aktif (tanpa paginasi) — dipakai katalog publik. */
  async listActive(): Promise<{ items: JasaDto[]; total: number }> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM jasa
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
    );
    const items = rows.map((r, i) => this.map(r, i + 1));
    return { items, total: items.length };
  }

  async create(input: SaveJasaInput): Promise<JasaDto> {
    const title = this.parseBilingual(input.title, 'Judul jasa wajib diisi', true);
    const slug = this.slugify(input.slug || title.id || title.en || '');
    if (!slug) throw new BadRequestException({ success: false, message: 'Judul jasa wajib diisi' });
    await this.assertSlugFree(slug);

    const nextOrder = await this.db.query<{ max: number | null }>(
      'SELECT MAX(sort_order) AS max FROM jasa',
    );
    const sortOrder = Number(nextOrder[0]?.max ?? 0) + 1;

    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO jasa
         (slug, title, price, description, features, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        slug,
        JSON.stringify(title),
        this.parsePrice(input.price),
        JSON.stringify(this.parseBilingual(input.description, '')),
        JSON.stringify(this.parseFeatures(input.features)),
        input.isActive === false ? false : true,
        sortOrder,
      ],
    );
    this.realtime.emitJasaChanged({ action: 'created' });
    return this.findById(Number(inserted[0].id));
  }

  async update(id: number, input: SaveJasaInput): Promise<JasaDto> {
    const existing = await this.rawById(id);
    if (!existing) throw new NotFoundException('Jasa tidak ditemukan');

    const title = this.parseBilingual(input.title, 'Judul jasa wajib diisi', true);
    const slug = this.slugify(input.slug || title.id || title.en || '');
    if (!slug) throw new BadRequestException({ success: false, message: 'Judul jasa wajib diisi' });
    await this.assertSlugFree(slug, id);

    await this.db.query(
      `UPDATE jasa
       SET slug = $1, title = $2, price = $3, description = $4, features = $5,
           is_active = $6, updated_at = NOW()
       WHERE id = $7`,
      [
        slug,
        JSON.stringify(title),
        this.parsePrice(input.price),
        JSON.stringify(this.parseBilingual(input.description, '')),
        JSON.stringify(this.parseFeatures(input.features)),
        input.isActive === false ? false : true,
        id,
      ],
    );
    this.realtime.emitJasaChanged({ action: 'updated' });
    return this.findById(id);
  }

  async delete(id: number): Promise<{ success: true }> {
    const existing = await this.rawById(id);
    if (!existing) throw new NotFoundException('Jasa tidak ditemukan');
    await this.db.query('DELETE FROM jasa WHERE id = $1', [id]);
    this.realtime.emitJasaChanged({ action: 'deleted' });
    return { success: true };
  }

  // ---------------- helpers ----------------

  private map(r: Record<string, unknown>, no: number): JasaDto {
    return {
      id: Number(r.id),
      no,
      slug: String(r.slug),
      title: (r.title as { id: string; en: string }) ?? { id: '', en: '' },
      price: String(r.price ?? '0'),
      description: (r.description as { id: string; en: string }) ?? { id: '', en: '' },
      features: Array.isArray(r.features) ? (r.features as { id: string; en: string }[]) : [],
      isActive: Boolean(r.is_active),
      sortOrder: Number(r.sort_order ?? 0),
      createdAt: new Date(r.created_at as string).toISOString(),
    };
  }

  private async rawById(id: number): Promise<{ id: number } | null> {
    const rows = await this.db.query<{ id: string }>('SELECT id FROM jasa WHERE id = $1', [id]);
    return rows[0] ? { id: Number(rows[0].id) } : null;
  }

  private async assertSlugFree(slug: string, exceptId?: number): Promise<void> {
    const rows = await this.db.query<{ id: string }>('SELECT id FROM jasa WHERE slug = $1', [slug]);
    if (rows[0] && Number(rows[0].id) !== exceptId) {
      throw new ConflictException({
        success: false,
        message: 'Slug jasa sudah dipakai. Gunakan judul/slug lain.',
      });
    }
  }

  private parseBilingual(
    value: { id?: string; en?: string } | undefined,
    message: string,
    required = false,
  ): { id: string; en: string } {
    const id = (value?.id ?? '').toString().trim();
    const en = (value?.en ?? '').toString().trim();
    if (required && !id && !en) {
      throw new BadRequestException({ success: false, message });
    }
    return { id: id || en, en: en || id };
  }

  private parsePrice(value: string | number | undefined): string {
    if (value === undefined || value === null) return '0';
    const digits = String(value).replace(/[^\d]/g, '');
    return digits || '0';
  }

  private parseFeatures(
    value: { id?: string; en?: string }[] | string | undefined,
  ): { id: string; en: string }[] {
    if (Array.isArray(value)) {
      return value
        .map((f) => ({
          id: (f?.id ?? '').toString().trim(),
          en: (f?.en ?? '').toString().trim(),
        }))
        .map((f) => ({ id: f.id || f.en, en: f.en || f.id }))
        .filter((f) => f.id || f.en);
    }
    if (typeof value === 'string') {
      return value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ id: line, en: line }));
    }
    return [];
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }
}
