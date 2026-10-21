import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PG_POOL } from '../database/database.service';
import type { Pool } from 'pg';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface ChatMessageDto {
  id: number | string;
  sender: 'user' | 'bot';
  content: string;
  createdAt: string;
}

interface ChatMessageRow {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  created_at: Date;
}

interface KnowledgeRow {
  category: string;
  question: string;
  answer: string;
  rank: number;
  sim: number;
  keyword_match: boolean;
  score?: number;
}

interface OrderSummaryRow {
  jenis_jasa: string;
  status: string;
  created_at: Date;
  jasa_slug: string | null;
}

export interface ChatReply {
  userMessage?: ChatMessageDto;
  botMessage: ChatMessageDto | { id: string; sender: 'bot'; content: string; createdAt: string };
  persisted: boolean;
}

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_HOURS = 24;
const RATE_LIMIT_PER_MINUTE = 15;

/** Estimasi durasi pengerjaan per slug jasa (dipakai untuk info pesanan). */
const SERVICE_DURATION: Record<string, string> = {
  'landing-page': '3–5 hari kerja',
  'website-tugas-kampus': '4–7 hari kerja',
  'website-kompleks': '2–4 minggu',
  'aplikasi-mobile': '3–6 minggu',
};

const STATUS_LABEL: Record<string, string> = {
  baru: 'Baru (menunggu ditangani admin)',
  diproses: 'Sedang diproses',
  selesai: 'Selesai',
  batal: 'Dibatalkan',
};

const GREETING =
  'Halo! Saya Bot JasaHUB. Saya bisa membantu menjelaskan layanan, harga paket, cara pemesanan, portofolio, dan kontak JasaHub. Ada yang ingin ditanyakan?';
const GUEST_GREETING =
  'Halo! Saya Bot JasaHUB. Saya bisa membantu menjelaskan layanan, harga paket, cara pemesanan, portofolio, dan kontak JasaHub. Sebagai tamu, percakapan ini tidak disimpan. Login sebagai pelanggan untuk menyimpan chat dan menanyakan status pesananmu. Ada yang bisa dibantu?';
const THANKS =
  'Sama-sama! Kalau ada pertanyaan lain tentang layanan atau cara pemesanan JasaHub, silakan tanyakan lagi.';
const FAREWELL =
  'Sampai jumpa! Semoga informasinya membantu. Kamu bisa kembali ke chat ini kapan saja (percakapan tersimpan 24 jam).';
const FALLBACK =
  'Maaf, saya belum menemukan informasi yang cocok untuk pertanyaan itu. Saya bisa membantu seputar 4 layanan JasaHub (Landing Page, Website Tugas Kampus, Website Kompleks, Aplikasi Mobile), harga, fitur paket, cara pemesanan, revisi, pembayaran, portofolio project, dan kontak. Kamu juga bisa menghubungi admin melalui halaman Kontak.';
const REFUSAL_SENSITIVE =
  'Maaf, saya tidak bisa membahas atau menampilkan informasi seputar admin, akun, kata sandi, token, basis data, atau konfigurasi internal. Saya hanya bisa membantu informasi layanan, harga, pemesanan, portofolio, dan kontak JasaHub. Untuk urusan akun, silakan hubungi admin melalui WhatsApp.';
const REFUSAL_PEER =
  'Maaf, data dan percakapan pelanggan lain bersifat pribadi, jadi tidak bisa saya tampilkan atau bahas. Chat ini hanya menyimpan percakapanmu sendiri selama 24 jam. Untuk bantuan lebih lanjut, silakan hubungi admin.';

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(password|passwd|kata\s*sandi|sandi|kredensial|credential|token|jwt|secret|hash|enkripsi|encrypt)\b/i,
  /\b(database|basis\s*data|db|sql|dump|schema|migration|migrasi|environment|env|api\s*key|apikey)\b/i,
  /\b(login|masuk)\s+(sebagai|jadi|ke)\s+(admin|administrator|root)\b/i,
  /\b(data|akun|email|profil|profil|rincian)\s+(admin|administrator|superadmin|root)\b/i,
  /\b(admin|administrator|superadmin)\s+(password|sandi|akun|email|token|data|database)\b/i,
  /\b(hack|bobol|retas|bypass|curang|exploit)\b/i,
];

const PEER_DATA_PATTERNS: RegExp[] = [
  /\b(pelanggan|user|customer|orang)\s+(lain|lainnya)\b/i,
  /\b(data|chat|pesan|akun|profil|nomor|email)\s+(pelanggan|user|customer)\s+(lain|lainnya)\b/i,
  /\b(lihat|buka|tampilkan|kasih|beri|ambil)\s+(semua\s+)?(chat|pesan|akun|password|data)\b/i,
  /\bdaftar\s+(akun|pelanggan|user|customer)\b/i,
];

const INJECTION_PATTERNS: RegExp[] = [
  /\b(abaikan|ignore|forget|lupakan|lewati)\b.*\b(instruksi|instruction|prompt|aturan|perintah|system)\b/i,
  /\b(system\s*prompt|prompt\s*sistem|instruksi\s*sistem|aturan\s*sistem)\b/i,
  /\b(kamu|anda|you)\s+(sekarang|now)\s+(adalah|are|menjadi)\b/i,
  /\bdeveloper\s*mode|jailbreak|dan\s*mode\b/i,
];

const STOPWORDS = new Set([
  'yang', 'untuk', 'dengan', 'apakah', 'bagaimana', 'gimana', 'berapa', 'bisa',
  'boleh', 'saya', 'aku', 'kamu', 'anda', 'apa', 'itu', 'ini', 'dan', 'atau',
  'dari', 'ke', 'di', 'pada', 'dalam', 'ada', 'tidak', 'ya', 'dong', 'sih',
  'mau', 'ingin', 'pesan', 'tanya', 'minta', 'tolong', 'kalau', 'jika', 'juga',
  'sudah', 'belum', 'akan', 'masih', 'punya', 'adalah', 'sebuah', 'the', 'is',
  'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'with', 'how', 'what',
  'jasahub', 'sebutkan', 'saja', 'aja', 'coba', 'info', 'informasi',
]);

const SHORT_TOKENS = new Set(['dp', 'wa', 'hp', 'seo', 'ui', 'ux', 'api']);

/** Deteksi pertanyaan tentang pesanan milik pelanggan sendiri. */
const ORDER_INTENT_PATTERNS: RegExp[] = [
  /\bpesanan\s+(saya|ku|aku|milik)\b/i,
  /\b(status|progres|progress)\s+(pesanan|order|proyek|project)\b/i,
  /\b(pesanan|order)\s+(saya|ku|aku)\s*(sudah|udah)?\s*(sampai|jadi|selesai|proses|diproses|dikerjakan)?\b/i,
  /\b(sudah|udah|kapan)\s+(jadi|selesai|diproses|dikerjakan)\b/i,
  /\bestimasi\s+(pesanan|pengerjaan|proyek|project|jasa)\b/i,
  /\b(berapa\s+lama|kapan)\s+(pesanan|order|proyek|project)\b/i,
  /\bpengiriman\s+(pesanan|order)\b/i,
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger('Chat');

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(userId: number | null): Promise<{ messages: ChatMessageDto[] }> {
    if (!userId) {
      // Tamu: percakapan tidak disimpan, cukup kirim sapaan awal.
      return {
        messages: [
          { id: 'guest-greeting', sender: 'bot', content: GUEST_GREETING, createdAt: new Date().toISOString() },
        ],
      };
    }

    await this.cleanup(userId);

    let messages = await this.fetchMessages(userId);
    if (messages.length === 0) {
      await this.insertMessage(userId, 'bot', GREETING);
      messages = await this.fetchMessages(userId);
    }

    return { messages };
  }

  async send(userId: number | null, rawContent: unknown): Promise<ChatReply> {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) {
      throw new BadRequestException('Pesan tidak boleh kosong.');
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Pesan terlalu panjang (maksimal ${MAX_MESSAGE_LENGTH} karakter).`,
      );
    }

    const replyText = await this.buildReply(content, userId);

    // Tamu: bot menjawab tanpa menyimpan percakapan.
    if (!userId) {
      const now = new Date().toISOString();
      return {
        botMessage: { id: `guest-${Date.now()}`, sender: 'bot', content: replyText, createdAt: now },
        persisted: false,
      };
    }

    await this.cleanup(userId);
    await this.enforceRateLimit(userId);

    const userMessage = await this.insertMessage(userId, 'user', content);
    const botMessage = await this.insertMessage(userId, 'bot', replyText);

    this.realtime.emitChatMessage(userId, { ...userMessage });
    this.realtime.emitChatMessage(userId, { ...botMessage });

    return { userMessage, botMessage, persisted: true };
  }

  async setTyping(userId: number | null, typing: boolean): Promise<{ ok: true }> {
    if (userId) this.realtime.emitChatTyping(userId, Boolean(typing));
    return { ok: true };
  }

  private async cleanup(userId: number): Promise<void> {
    await this.pool.query(
      `DELETE FROM chat_messages
       WHERE user_id = $1
         AND created_at < NOW() - INTERVAL '${HISTORY_HOURS} hours'`,
      [userId],
    );
  }

  private async enforceRateLimit(userId: number): Promise<void> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM chat_messages
       WHERE user_id = $1
         AND sender = 'user'
         AND created_at > NOW() - INTERVAL '1 minute'`,
      [userId],
    );
    if (Number(rows[0]?.count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      throw new BadRequestException(
        'Terlalu banyak pesan dalam satu menit. Silakan tunggu sebentar lalu coba lagi.',
      );
    }
  }

  private async fetchMessages(userId: number): Promise<ChatMessageDto[]> {
    const { rows } = await this.pool.query<ChatMessageRow>(
      `SELECT id, sender, content, created_at
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY created_at ASC, id ASC`,
      [userId],
    );
    return rows.map((row) => this.toDto(row));
  }

  private async insertMessage(
    userId: number,
    sender: 'user' | 'bot',
    content: string,
  ): Promise<ChatMessageDto> {
    try {
      const { rows } = await this.pool.query<ChatMessageRow>(
        `INSERT INTO chat_messages (user_id, sender, content)
         VALUES ($1, $2, $3)
         RETURNING id, sender, content, created_at`,
        [userId, sender, content],
      );
      return this.toDto(rows[0]);
    } catch (error) {
      // Token valid tapi user sudah tidak ada (dihapus/dinonaktifkan) → FK 23503.
      if ((error as { code?: string }).code === '23503') {
        throw new UnauthorizedException({
          success: false,
          message: 'Akun tidak ditemukan atau sudah tidak aktif. Silakan login ulang.',
        });
      }
      throw error;
    }
  }

  private toDto(row: ChatMessageRow): ChatMessageDto {
    return {
      id: Number(row.id),
      sender: row.sender,
      content: row.content,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  }

  private async buildReply(content: string, userId: number | null): Promise<string> {
    const normalized = this.normalize(content);
    const compact = normalized.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

    if (this.isGreeting(compact)) return userId ? GREETING : GUEST_GREETING;
    if (this.isThanks(compact)) return THANKS;
    if (this.isFarewell(compact)) return FAREWELL;

    if (INJECTION_PATTERNS.some((pattern) => pattern.test(content))) {
      return REFUSAL_SENSITIVE;
    }
    if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(content))) {
      return REFUSAL_SENSITIVE;
    }
    if (PEER_DATA_PATTERNS.some((pattern) => pattern.test(content))) {
      return REFUSAL_PEER;
    }

    // Pertanyaan tentang pesanan sendiri.
    if (ORDER_INTENT_PATTERNS.some((pattern) => pattern.test(content))) {
      return this.answerOrderQuery(userId);
    }

    const tokens = Array.from(
      new Set(
        compact
          .split(' ')
          .filter(
            (token) =>
              (token.length >= 3 || SHORT_TOKENS.has(token)) &&
              !STOPWORDS.has(token),
          ),
      ),
    );

    const searchText = tokens.length > 0 ? tokens.join(' ') : compact || normalized;
    const matches = await this.retrieve(searchText, tokens);

    if (matches.length === 0) return FALLBACK;

    const best = matches[0];
    if (!best.answer) return FALLBACK;

    // Butuh skor minimum agar tidak menjawab ngawur untuk pertanyaan
    // yang tidak relevan (mis. "cuaca hari ini").
    const score = best.score ?? best.sim + best.rank;
    const threshold = tokens.length > 0 ? 0.35 : 0.55;
    if (score < threshold) return FALLBACK;

    return best.answer;
  }

  /**
   * Jawab pertanyaan pesanan dengan ringkasan pesanan milik pelanggan sendiri.
   * Hanya menampilkan jenis jasa, tanggal, status, dan estimasi durasi —
   * tidak pernah menampilkan alamat, nomor WA, catatan, atau data pribadi.
   */
  private async answerOrderQuery(userId: number | null): Promise<string> {
    if (!userId) {
      return 'Sebagai tamu, saya tidak bisa mengakses data pesanan. Silakan login sebagai pelanggan untuk melihat status dan estimasi pesananmu. Untuk saat ini, status pesanan hanya bisa dikonfirmasi admin melalui WhatsApp.';
    }

    const orders = await this.findOrdersForUser(userId);

    if (orders.length === 0) {
      return 'Saya belum menemukan data pesanan yang terhubung dengan akunmu. Jika kamu sudah pernah memesan, pastikan nama saat memesan sama dengan nama di akunmu, atau hubungi admin melalui WhatsApp untuk mengecek status pesanan.';
    }

    const lines = orders.slice(0, 5).map((order, index) => {
      const tanggal = this.formatDate(order.created_at);
      const status = STATUS_LABEL[order.status] ?? order.status;
      const durasi = order.jasa_slug ? SERVICE_DURATION[order.jasa_slug] : null;
      const estimasi = durasi
        ? `Estimasi pengerjaan sekitar ${durasi}.`
        : 'Estimasi pengerjaan akan dikonfirmasi admin.';
      return `${index + 1}. ${order.jenis_jasa}\n   • Dipesan: ${tanggal}\n   • Status: ${status}\n   • ${estimasi}`;
    });

    return `Berikut ringkasan pesananmu:\n\n${lines.join(
      '\n\n',
    )}\n\nCatatan: status terbaru selalu dikonfirmasi admin melalui WhatsApp. Untuk mengubah pesanan, hubungi admin langsung.`;
  }

  private async findOrdersForUser(userId: number): Promise<OrderSummaryRow[]> {
    try {
      // Cocokkan via profil pelanggan (nama) atau nama pada akun.
      const { rows } = await this.pool.query<OrderSummaryRow>(
        `
        SELECT p.jenis_jasa, p.status, p.created_at, p.jasa_slug
        FROM pesanan p
        WHERE LOWER(TRIM(p.nama_lengkap)) IN (
          SELECT LOWER(TRIM(pl.nama))
          FROM pelanggan pl
          WHERE pl.user_id = $1 AND pl.nama IS NOT NULL
          UNION
          SELECT LOWER(TRIM(u.email))
          FROM users u
          WHERE u.id = $1
        )
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 5
        `,
        [userId],
      );
      return rows;
    } catch (error) {
      this.logger.warn(
        `Lookup pesanan gagal: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private formatDate(value: Date): string {
    try {
      const date = value instanceof Date ? value : new Date(value);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      });
    } catch {
      return '-';
    }
  }

  private async retrieve(
    searchText: string,
    tokens: string[],
  ): Promise<KnowledgeRow[]> {
    try {
      const { rows } = await this.pool.query<KnowledgeRow & { score: number }>(
        `
        WITH q AS (SELECT websearch_to_tsquery('indonesian', $1) AS tsq)
        SELECT
          k.category,
          k.question,
          k.answer,
          ts_rank(k.search_tsv, q.tsq) AS rank,
          similarity(k.question, $1) AS sim,
          (k.keywords && $2::text[]) AS keyword_match,
          (
            ts_rank(k.search_tsv, q.tsq) * 3
            + similarity(k.question, $1) * 2
            + CASE WHEN k.keywords && $2::text[] THEN 1 ELSE 0 END
          ) AS score
        FROM chat_knowledge k, q
        WHERE k.search_tsv @@ q.tsq
           OR similarity(k.question, $1) > 0.2
           OR (k.keywords && $2::text[])
        ORDER BY score DESC
        LIMIT 6
        `,
        [searchText, tokens],
      );
      return rows;
    } catch (error) {
      this.logger.warn(
        `Pencarian knowledge gagal: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isGreeting(value: string): boolean {
    return /^(halo|hallo|hai|hi|hello|hey|pagi|siang|sore|malam|assalamualaikum|permisi|selamat (pagi|siang|sore|malam))$/.test(
      value,
    );
  }

  private isThanks(value: string): boolean {
    return /^(terima kasih|terimakasih|makasih|thanks|thank you|oke terima kasih|ok terima kasih|sip terima kasih)$/.test(
      value,
    );
  }

  private isFarewell(value: string): boolean {
    return /^(bye|byebye|dadah|sampai jumpa|selamat tinggal|cukup sekian)$/.test(
      value,
    );
  }
}
