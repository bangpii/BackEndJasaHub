import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.service';
import { MailerService } from './mailer.service';

const NAME_MAX = 120;
const PHONE_MAX = 40;
const EMAIL_MAX = 160;
const MESSAGE_MAX = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  nama?: unknown;
  telepon?: unknown;
  email?: unknown;
  pesan?: unknown;
}

export interface ContactResult {
  success: true;
  id: number;
  emailed: boolean;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger('Contact');

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly mailer: MailerService,
  ) {}

  async submit(input: ContactInput): Promise<ContactResult> {
    const nama = this.str(input.nama);
    const telepon = this.str(input.telepon);
    const email = this.str(input.email);
    const pesan = this.str(input.pesan);

    if (!nama) throw new BadRequestException('Nama wajib diisi.');
    if (!telepon) throw new BadRequestException('Nomor telepon wajib diisi.');
    if (!email) throw new BadRequestException('Email wajib diisi.');
    if (!pesan) throw new BadRequestException('Pesan wajib diisi.');

    if (nama.length > NAME_MAX) {
      throw new BadRequestException(`Nama maksimal ${NAME_MAX} karakter.`);
    }
    if (telepon.length > PHONE_MAX) {
      throw new BadRequestException(`Nomor telepon maksimal ${PHONE_MAX} karakter.`);
    }
    if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
      throw new BadRequestException('Format email tidak valid.');
    }
    if (pesan.length > MESSAGE_MAX) {
      throw new BadRequestException(`Pesan maksimal ${MESSAGE_MAX} karakter.`);
    }

    // Simpan dulu agar pesan tidak hilang walau email gagal terkirim.
    const { rows } = await this.pool.query<{ id: number }>(
      `INSERT INTO contact_messages (nama, telepon, email, pesan)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [nama, telepon, email, pesan],
    );
    const id = Number(rows[0].id);

    const emailed = await this.mailer.sendContactMessage({
      nama,
      telepon,
      email,
      pesan,
    });

    await this.pool.query(
      `UPDATE contact_messages
       SET email_status = $2
       WHERE id = $1`,
      [id, emailed ? 'sent' : 'failed'],
    );

    if (!emailed) {
      this.logger.warn(`Email pesan kontak #${id} gagal terkirim.`);
    }

    return { success: true, id, emailed };
  }

  private str(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
