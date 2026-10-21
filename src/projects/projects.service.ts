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

export interface ProjectDto {
  id: number;
  no: number;
  slug: string;
  name: string;
  imageSrc: string | null;
  github: string | null;
  url: string | null;
  languages: string[];
  role: { id: string; en: string } | null;
  description: { id: string; en: string };
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface SaveProjectInput {
  slug?: string;
  name?: string;
  imageSrc?: string | null;
  github?: string | null;
  url?: string | null;
  languages?: string[] | string;
  role?: { id?: string; en?: string } | null;
  description?: { id?: string; en?: string };
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
export class ProjectsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(page = 1, pageSize = 9, search = ''): Promise<PagedResult<ProjectDto>> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const limit =
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), MAX_PAGE_SIZE)
        : 9;
    const offset = (safePage - 1) * limit;
    const term = `%${search.trim().toLowerCase()}%`;

    const totalRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM projects
       WHERE ($1 = '' OR LOWER(name) LIKE $2 OR LOWER(slug) LIKE $2)`,
      [search.trim(), term],
    );
    const total = Number(totalRows[0]?.count ?? 0);

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM projects
       WHERE ($1 = '' OR LOWER(name) LIKE $2 OR LOWER(slug) LIKE $2)
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

  async findById(id: number): Promise<ProjectDto> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM projects WHERE id = $1',
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Jasa tidak ditemukan');
    return this.map(rows[0], 0);
  }

  async findBySlug(slug: string): Promise<ProjectDto> {
    const rows = await this.db.query<Record<string, unknown>>(
      'SELECT * FROM projects WHERE slug = $1',
      [slug],
    );
    if (!rows[0]) throw new NotFoundException('Jasa tidak ditemukan');
    return this.map(rows[0], 0);
  }

  /** Semua project aktif (tanpa paginasi) — dipakai katalog publik / About. */
  async listActive(): Promise<{ items: ProjectDto[]; total: number }> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM projects
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
    );
    const items = rows.map((r, i) => this.map(r, i + 1));
    return { items, total: items.length };
  }

  async create(input: SaveProjectInput): Promise<ProjectDto> {
    const name = this.require(input.name, 'Nama jasa wajib diisi');
    const slug = this.slugify(input.slug || name);
    await this.assertSlugFree(slug);

    const nextOrder = await this.db.query<{ max: number | null }>(
      'SELECT MAX(sort_order) AS max FROM projects',
    );
    const sortOrder = Number(nextOrder[0]?.max ?? 0) + 1;

    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO projects
         (slug, name, image_src, github, url, languages, role, description, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        slug,
        name,
        this.nullable(input.imageSrc),
        this.nullable(input.github),
        this.nullable(input.url),
        this.parseLanguages(input.languages),
        this.parseRole(input.role),
        this.parseDescription(input.description),
        input.isActive === false ? false : true,
        sortOrder,
      ],
    );
    this.realtime.emitProjectsChanged({ action: 'created' });
    return this.findById(Number(inserted[0].id));
  }

  async update(id: number, input: SaveProjectInput): Promise<ProjectDto> {
    const existing = await this.rawById(id);
    if (!existing) throw new NotFoundException('Jasa tidak ditemukan');

    const name = this.require(input.name, 'Nama jasa wajib diisi');
    const slug = this.slugify(input.slug || name);
    await this.assertSlugFree(slug, id);

    await this.db.query(
      `UPDATE projects
       SET slug = $1, name = $2, image_src = $3, github = $4, url = $5,
           languages = $6, role = $7, description = $8, is_active = $9,
           updated_at = NOW()
       WHERE id = $10`,
      [
        slug,
        name,
        this.nullable(input.imageSrc),
        this.nullable(input.github),
        this.nullable(input.url),
        this.parseLanguages(input.languages),
        this.parseRole(input.role),
        this.parseDescription(input.description),
        input.isActive === false ? false : true,
        id,
      ],
    );
    this.realtime.emitProjectsChanged({ action: 'updated' });
    return this.findById(id);
  }

  async delete(id: number): Promise<{ success: true }> {
    const existing = await this.rawById(id);
    if (!existing) throw new NotFoundException('Jasa tidak ditemukan');
    await this.db.query('DELETE FROM projects WHERE id = $1', [id]);
    this.realtime.emitProjectsChanged({ action: 'deleted' });
    return { success: true };
  }

  // ---------------- helpers ----------------

  private map(r: Record<string, unknown>, no: number): ProjectDto {
    return {
      id: Number(r.id),
      no,
      slug: String(r.slug),
      name: String(r.name),
      imageSrc: (r.image_src as string | null) ?? null,
      github: (r.github as string | null) ?? null,
      url: (r.url as string | null) ?? null,
      languages: Array.isArray(r.languages) ? (r.languages as string[]) : [],
      role: (r.role as { id: string; en: string } | null) ?? null,
      description: (r.description as { id: string; en: string }) ?? { id: '', en: '' },
      isActive: Boolean(r.is_active),
      sortOrder: Number(r.sort_order ?? 0),
      createdAt: new Date(r.created_at as string).toISOString(),
    };
  }

  private async rawById(id: number): Promise<{ id: number } | null> {
    const rows = await this.db.query<{ id: string }>('SELECT id FROM projects WHERE id = $1', [
      id,
    ]);
    return rows[0] ? { id: Number(rows[0].id) } : null;
  }

  private async assertSlugFree(slug: string, exceptId?: number): Promise<void> {
    const rows = await this.db.query<{ id: string }>(
      'SELECT id FROM projects WHERE slug = $1',
      [slug],
    );
    if (rows[0] && Number(rows[0].id) !== exceptId) {
      throw new ConflictException({
        success: false,
        message: 'Slug jasa sudah dipakai. Gunakan nama/slug lain.',
      });
    }
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

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private parseLanguages(value: string[] | string | undefined): string[] {
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [];
  }

  private parseRole(value: { id?: string; en?: string } | null | undefined): string | null {
    if (!value || (!value.id && !value.en)) return null;
    return JSON.stringify({ id: value.id ?? '', en: value.en ?? '' });
  }

  private parseDescription(
    value: { id?: string; en?: string } | undefined,
  ): string {
    return JSON.stringify({ id: value?.id ?? '', en: value?.en ?? '' });
  }
}
