import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '../auth/token.util';

export interface AuthedUser {
  sub: number;
  role: 'pelanggan' | 'admin';
}

export interface AuthedRequest {
  headers: Record<string, string | undefined>;
  user?: AuthedUser;
}

const readToken = (request: AuthedRequest): string => {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

/**
 * Guard opsional (soft auth) untuk pembuatan pesanan:
 *  - Tanpa token / token tidak valid → request tetap jalan sebagai tamu.
 *  - Token pelanggan valid → `request.user` diisi (pesanan ter-link ke akun).
 */
@Injectable()
export class OptionalPelangganGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const payload = verifyToken(readToken(request));

    if (payload && payload.role === 'pelanggan') {
      request.user = { sub: payload.sub, role: payload.role };
    }

    return true;
  }
}

/**
 * Guard wajib login sebagai pelanggan (untuk "pesanan saya").
 */
@Injectable()
export class PelangganGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const payload = verifyToken(readToken(request));

    if (!payload || payload.role !== 'pelanggan') {
      throw new UnauthorizedException({
        success: false,
        message: 'Silakan login terlebih dahulu',
      });
    }

    request.user = { sub: payload.sub, role: payload.role };
    return true;
  }
}
