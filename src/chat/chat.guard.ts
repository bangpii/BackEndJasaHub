import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { verifyToken } from '../auth/token.util';

export interface ChatUser {
  sub: number;
  role: 'pelanggan' | 'admin';
}

export interface ChatRequest {
  headers: Record<string, string | undefined>;
  user?: ChatUser;
}

/**
 * Guard chat bersifat opsional (soft auth):
 *  - Tanpa token / token tidak valid → request tetap jalan sebagai tamu.
 *  - Token pelanggan valid → `request.user` diisi (fitur simpan + info pesanan).
 */
@Injectable()
export class ChatGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ChatRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = verifyToken(token);

    if (payload && payload.role === 'pelanggan') {
      request.user = { sub: payload.sub, role: payload.role };
    }

    return true;
  }
}
