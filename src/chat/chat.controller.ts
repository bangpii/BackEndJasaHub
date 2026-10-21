import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ChatGuard, ChatRequest } from './chat.guard';
import { ChatService } from './chat.service';

@Controller('api/chat')
@UseGuards(ChatGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('messages')
  list(@Req() request: ChatRequest) {
    return this.chat.list(request.user?.sub ?? null);
  }

  @Post('messages')
  send(@Req() request: ChatRequest, @Body('content') content: unknown) {
    return this.chat.send(request.user?.sub ?? null, content);
  }

  @Post('typing')
  typing(@Req() request: ChatRequest, @Body('typing') typing: boolean) {
    return this.chat.setTyping(request.user?.sub ?? null, Boolean(typing));
  }
}
