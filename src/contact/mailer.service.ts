import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface ContactMessagePayload {
  nama: string;
  telepon: string;
  email: string;
  pesan: string;
}

/**
 * Mengirim email notifikasi melalui SMTP Gmail.
 *
 * Butuh env:
 *   GMAIL_USER          -> alamat Gmail pengirim (mis. baihaiearrafi6@gmail.com)
 *   GMAIL_APP_PASSWORD  -> App Password 16 karakter (bukan password Gmail biasa)
 *   CONTACT_TO          -> (opsional) tujuan notifikasi, default GMAIL_USER
 *
 * Bila env belum diisi, pengiriman di-skip (return false) supaya aplikasi
 * tetap jalan dan pesan tetap tersimpan di database.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger('Mailer');
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  private readonly to: string;

  constructor() {
    const user = process.env.GMAIL_USER?.trim();
    const pass = process.env.GMAIL_APP_PASSWORD?.trim();

    this.from = user ?? '';
    this.to = process.env.CONTACT_TO?.trim() || user || '';

    if (!user || !pass) {
      this.transporter = null;
      this.logger.warn(
        'GMAIL_USER / GMAIL_APP_PASSWORD belum di-set. Email kontak tidak akan terkirim (pesan tetap disimpan).',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  async sendContactMessage(payload: ContactMessagePayload): Promise<boolean> {
    if (!this.transporter) return false;

    const { nama, telepon, email, pesan } = payload;
    const subject = `Pesan Kontak Baru — ${nama}`;
    const text =
      `Pesan baru dari form Kontak JasaHub\n\n` +
      `Nama    : ${nama}\n` +
      `Telepon : ${telepon}\n` +
      `Email   : ${email}\n\n` +
      `Pesan:\n${pesan}\n`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Pesan Kontak Baru — JasaHub</h2>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Nama</td><td>${this.escape(nama)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Telepon</td><td>${this.escape(telepon)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Email</td><td>${this.escape(email)}</td></tr>
        </table>
        <p style="margin:16px 0 4px;font-weight:bold">Pesan</p>
        <p style="white-space:pre-wrap;margin:0">${this.escape(pesan)}</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"JasaHub Kontak" <${this.from}>`,
        to: this.to,
        replyTo: email,
        subject,
        text,
        html,
      });
      return true;
    } catch (err) {
      const e = err as { code?: string; response?: string; command?: string };
      this.logger.error(
        `Gagal mengirim email kontak: code=${e.code ?? '-'} command=${e.command ?? '-'} | ${e.response ?? (err instanceof Error ? err.message : String(err))}`,
      );
      return false;
    }
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
