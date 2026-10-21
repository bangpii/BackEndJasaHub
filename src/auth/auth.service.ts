import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { signToken, verifyToken } from './token.util';

interface UserRow extends Record<string, unknown> {
  id: string;
  email: string;
  password: string;
  role: 'pelanggan' | 'admin';
  is_active: boolean;
}

export interface PublicUser {
  id: number;
  email: string;
  role: 'pelanggan' | 'admin';
  nama: string | null;
  telepon: string | null;
  alamat: string | null;
  kota: string | null;
  provinsi: string | null;
  kodePos: string | null;
  jabatan: string | null;
  foto: string | null;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login(email: string, password: string, expectedRole: 'pelanggan' | 'admin') {
    if (!email?.trim() || !password) {
      throw new BadRequestException({
        success: false,
        message: 'Email dan password wajib diisi',
      });
    }

    const rows = await this.db.query<UserRow>(
      'SELECT id, email, password, role, is_active FROM users WHERE email = $1',
      [email.trim().toLowerCase()],
    );
    const user = rows[0];

    const valid = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !valid) {
      throw new UnauthorizedException({
        success: false,
        message: 'Email atau password salah',
      });
    }

    if (!user.is_active) {
      throw new UnauthorizedException({
        success: false,
        message: 'Akun dinonaktifkan. Hubungi admin.',
      });
    }

    if (user.role !== expectedRole) {
      throw new UnauthorizedException({
        success: false,
        message:
          user.role === 'admin'
            ? 'Akun ini adalah admin. Silakan login melalui halaman admin.'
            : 'Hanya akun admin yang dapat login di halaman ini.',
      });
    }

    const profile = await this.getProfile(user);
    const token = signToken({ sub: Number(user.id), role: user.role });

    return { success: true, token, user: this.toPublicUser(user, profile) };
  }

  async verify(token: string) {
    const payload = verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException({
        success: false,
        message: 'Sesi tidak valid atau sudah berakhir',
      });
    }

    const rows = await this.db.query<UserRow>(
      'SELECT id, email, password, role, is_active FROM users WHERE id = $1',
      [payload.sub],
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      throw new UnauthorizedException({
        success: false,
        message: 'Akun tidak ditemukan atau dinonaktifkan',
      });
    }

    const profile = await this.getProfile(user);
    return { success: true, user: this.toPublicUser(user, profile) };
  }

  private async getProfile(user: UserRow): Promise<Record<string, unknown> | null> {
    if (user.role === 'admin') {
      const rows = await this.db.query<Record<string, unknown>>(
        'SELECT nama, jabatan, telepon, foto FROM admin WHERE user_id = $1',
        [user.id],
      );
      return rows[0] ?? null;
    }

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT nama, telepon, alamat, kota, provinsi, kode_pos, foto
       FROM pelanggan WHERE user_id = $1`,
      [user.id],
    );
    return rows[0] ?? null;
  }

  private toPublicUser(user: UserRow, profile: Record<string, unknown> | null): PublicUser {
    return {
      id: Number(user.id),
      email: user.email,
      role: user.role,
      nama: (profile?.nama as string | null) ?? null,
      telepon: (profile?.telepon as string | null) ?? null,
      alamat: (profile?.alamat as string | null) ?? null,
      kota: (profile?.kota as string | null) ?? null,
      provinsi: (profile?.provinsi as string | null) ?? null,
      kodePos: (profile?.kode_pos as string | null) ?? null,
      jabatan: (profile?.jabatan as string | null) ?? null,
      foto: (profile?.foto as string | null) ?? null,
    };
  }
}
