/**
 * Chat Controller
 * 
 * Handles chat API endpoints with proper NestJS patterns.
 */

import { 
  Controller, 
  Post, 
  Param, 
  Req, 
  Res, 
  HttpStatus,
  HttpException,
  Logger 
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatService } from './chat.service';

// Import shared utilities
const { generateRequestId } = require('../../../shared/agent-config');

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post(':sessionId')
  async handleChat(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const requestId = generateRequestId();
    
    try {
      // Validate session ID
      if (!sessionId) {
        throw new HttpException(
          {
            error: 'Invalid path',
            message: 'sessionId is required',
            requestId,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      
      // Use chat service to handle the request
      const response = await this.chatService.handleChatRequest(sessionId, req);
      
      // Set response headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      
      // Set status code
      res.status(response.status);
      
      // Stream response body
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      
      res.end();
      
    } catch (error) {
      this.logger.error('Error in chat controller', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId,
        method: req.method,
        url: req.originalUrl,
        requestId,
      });
      
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Otherwise, throw a generic 500 error
      throw new HttpException(
        {
          error: 'Internal server error',
          message: 'An unexpected error occurred',
          requestId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}