import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';

interface LoginBody {
  email?: string;
  password?: string;
  role?: string;
}

@Controller('api')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginBody) {
    const role = body?.role;
    if (role !== 'pelanggan' && role !== 'admin') {
      throw new BadRequestException({
        success: false,
        message: 'Role login tidak valid (pelanggan | admin)',
      });
    }
    return this.auth.login(body?.email ?? '', body?.password ?? '', role);
  }

  @Get('verify')
  verify(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    return this.auth.verify(token);
  }
}
