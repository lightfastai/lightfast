/**
 * NestJS Application Module
 * 
 * This module defines the main application structure for the NestJS backend.
 */

import { Module } from '@nestjs/common';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { HealthController } from './health/health.controller';
import { AppController } from './app.controller';

@Module({
  imports: [],
  controllers: [
    AppController,
    ChatController,
    HealthController,
  ],
  providers: [
    ChatService,
  ],
})
export class AppModule {}