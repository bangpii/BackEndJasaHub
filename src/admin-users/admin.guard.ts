import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '../auth/token.util';

/**
 * Guard ringan: memastikan request membawa Bearer token milik admin yang valid.
 * Payload token ditempel ke `request.user` untuk dipakai controller/service.
 */
export interface AuthenticatedAdmin {
  sub: number;
  role: 'pelanggan' | 'admin';
}

export interface AdminRequest {
  headers: Record<string, string | undefined>;
  user?: AuthenticatedAdmin;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = verifyToken(token);

    if (!payload || payload.role !== 'admin') {
      throw new UnauthorizedException({
        success: false,
        message: 'Akses ditolak. Hanya admin yang dapat mengelola akun.',
      });
    }

    request.user = { sub: payload.sub, role: payload.role };
    return true;
  }
}
