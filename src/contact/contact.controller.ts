import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';

@Controller('api/contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  submit(@Body() body: Record<string, unknown>) {
    return this.contact.submit(body ?? {});
  }
}
