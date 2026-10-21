import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { verifyToken } from '../auth/token.util';

/**
 * Gateway Socket.IO untuk realtime JasaHub.
 *
 * Room:
 *  - `public`   : halaman pelanggan (landing/About) — menerima event katalog.
 *  - `admin`    : panel admin — menerima event internal (opsional).
 *
 * Event yang dipancarkan:
 *  - `projects:changed` : saat project ditambah/diubah/dihapus.
 *
 * Catatan deploy: WebSocket hanya berjalan di hosting long-running
 * (Render/Railway/Fly/VPS). Di Vercel (serverless) koneksi ini akan gagal
 * dan frontend otomatis jatuh ke mode polling.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');

  @WebSocketServer()
  server!: Server;

  handleConnection(socket: Socket): void {
    const scope = socket.handshake.query?.scope;

    if (scope === 'chat') {
      const rawToken =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.query?.token as string | undefined) ??
        '';
      const payload = verifyToken(rawToken);
      if (!payload || payload.role !== 'pelanggan') {
        socket.emit('chat:unauthorized', { message: 'Token chat tidak valid.' });
        socket.disconnect(true);
        return;
      }
      const room = `chat:${payload.sub}`;
      socket.join(room);
      socket.emit('ready', { room });
      this.logger.log(`Client ${socket.id} join room "${room}"`);
      return;
    }

    const room = scope === 'admin' ? 'admin' : 'public';
    socket.join(room);
    socket.emit('ready', { room });
    this.logger.log(`Client ${socket.id} join room "${room}"`);
  }

  /** Pancarkan perubahan katalog project ke seluruh klien. */
  emitProjectsChanged(payload?: Record<string, unknown>): void {
    this.server?.emit('projects:changed', {
      at: new Date().toISOString(),
      ...payload,
    });
  }

  /** Pancarkan perubahan katalog jasa ke seluruh klien. */
  emitJasaChanged(payload?: Record<string, unknown>): void {
    this.server?.emit('jasa:changed', {
      at: new Date().toISOString(),
      ...payload,
    });
  }

  /** Pancarkan perubahan akun (admin/pelanggan) ke panel admin. */
  emitAccountsChanged(payload?: Record<string, unknown>): void {
    this.server?.to('admin').emit('accounts:changed', {
      at: new Date().toISOString(),
      ...payload,
    });
  }

  /** Pancarkan perubahan pesanan: ke panel admin + halaman pelanggan (fitur "Proses"). */
  emitPesananChanged(payload?: Record<string, unknown>): void {
    const body = { at: new Date().toISOString(), ...payload };
    this.server?.to('admin').emit('pesanan:changed', body);
    this.server?.to('public').emit('pesanan:changed', body);
  }

  /** Kirim pesan chat baru ke room pribadi pelanggan (bila socket aktif). */
  emitChatMessage(userId: number, message: Record<string, unknown>): void {
    this.server?.to(`chat:${userId}`).emit('chat:message', message);
  }

  /** Kirim indikator mengetik bot ke room pribadi pelanggan. */
  emitChatTyping(userId: number, typing: boolean): void {
    this.server?.to(`chat:${userId}`).emit('chat:typing', {
      typing,
      at: new Date().toISOString(),
    });
  }
}
