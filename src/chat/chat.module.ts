import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGuard } from './chat.guard';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatGuard],
})
export class ChatModule {}
