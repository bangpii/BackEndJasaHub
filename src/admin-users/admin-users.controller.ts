import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminGuard, AdminRequest } from './admin.guard';
import {
  AdminUsersService,
  SaveAdminInput,
  SavePelangganInput,
} from './admin-users.service';
import { DatabaseService } from '../database/database.service';

interface RevealBody {
  password?: string;
}

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(
    private readonly accounts: AdminUsersService,
    private readonly db: DatabaseService,
  ) {}

  // ---------- ADMIN ----------
  @Get('admins')
  listAdmins(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.accounts.listAdmins(Number(page) || 1, Number(pageSize) || 8, search ?? '');
  }

  @Post('admins')
  createAdmin(@Body() body: SaveAdminInput) {
    return this.accounts.createAdmin(body ?? {});
  }

  @Put('admins/:id')
  updateAdmin(@Param('id', ParseIntPipe) id: number, @Body() body: SaveAdminInput) {
    return this.accounts.updateAdmin(id, body ?? {});
  }

  @Delete('admins/:id')
  deleteAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.deleteAdmin(id);
  }

  // ---------- PELANGGAN ----------
  @Get('pelanggan')
  listPelanggan(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.accounts.listPelanggan(Number(page) || 1, Number(pageSize) || 8, search ?? '');
  }

  @Post('pelanggan')
  createPelanggan(@Body() body: SavePelangganInput) {
    return this.accounts.createPelanggan(body ?? {});
  }

  @Put('pelanggan/:id')
  updatePelanggan(@Param('id', ParseIntPipe) id: number, @Body() body: SavePelangganInput) {
    return this.accounts.updatePelanggan(id, body ?? {});
  }

  @Delete('pelanggan/:id')
  deletePelanggan(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.deletePelanggan(id);
  }

  // ---------- REVEAL (verifikasi password admin yang sedang login) ----------
  @Post('admins/:id/reveal')
  async revealAdmin(
    @Req() req: AdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RevealBody,
  ) {
    await this.assertAdminPassword(req, body);
    return { success: true, data: await this.accounts.revealAdmin(id) };
  }

  @Post('pelanggan/:id/reveal')
  async revealPelanggan(
    @Req() req: AdminRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RevealBody,
  ) {
    await this.assertAdminPassword(req, body);
    return { success: true, data: await this.accounts.revealPelanggan(id) };
  }

  private async assertAdminPassword(req: AdminRequest, body: RevealBody): Promise<void> {
    const password = body?.password ?? '';
    if (!password) {
      throw new BadRequestException({ success: false, message: 'Password wajib diisi' });
    }
    const rows = await this.db.query<{ password: string }>(
      'SELECT password FROM users WHERE id = $1',
      [req.user!.sub],
    );
    const hash = rows[0]?.password;
    const valid = hash ? await bcrypt.compare(password, hash) : false;
    if (!valid) {
      throw new UnauthorizedException({ success: false, message: 'Password salah' });
    }
  }
}
