import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { MailerService } from './mailer.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService, MailerService],
})
export class ContactModule {}
