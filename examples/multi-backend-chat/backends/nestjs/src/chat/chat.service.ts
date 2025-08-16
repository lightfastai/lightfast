/**
 * Chat Service
 * 
 * Service class that handles the Lightfast agent configuration and chat logic.
 */

import { Injectable, Logger } from '@nestjs/common';
import { fetchRequestHandler } from '@lightfastai/core/server/adapters/fetch';

// Import shared configuration - we need to use require for CommonJS modules
const {
  createChatAgent,
  createMemory,
  generateRequestId,
} = require('../../../shared/agent-config');

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly memory;

  constructor() {
    // Create memory instance (shared across requests)
    this.memory = createMemory();
  }

  /**
   * Handle chat request using Lightfast fetchRequestHandler
   * @param sessionId - Session identifier
   * @param request - Express-like request object
   * @returns Promise<Response> - Fetch Response object
   */
  async handleChatRequest(sessionId: string, request: any): Promise<Response> {
    const requestId = generateRequestId();
    
    try {
      // Create userId for this session
      const userId = `user_${sessionId}`;
      
      // Create agent
      const agent = createChatAgent({ sessionId, userId });
      
      // Convert Express-like request to Fetch API Request
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else if (value) {
          headers.set(key, value as string);
        }
      });
      
      const url = `${request.protocol}://${request.get('host')}${request.originalUrl}`;
      
      const fetchRequest = new Request(url, {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
      
      // Use fetchRequestHandler
      const response = await fetchRequestHandler({
        agent,
        sessionId,
        memory: this.memory,
        req: fetchRequest,
        resourceId: userId,
        context: {
          modelId: 'openai/gpt-5-nano',
          backend: 'nestjs',
        },
        createRequestContext: (req: Request) => ({
          userAgent: req.headers.get('user-agent') ?? undefined,
          ipAddress: req.headers.get('x-forwarded-for') ?? 
                    req.headers.get('x-real-ip') ?? 
                    undefined,
        }),
        generateId: generateRequestId,
        enableResume: true,
        onError: ({ error }: { error: Error }) => {
          this.logger.error(`Session: ${sessionId}, User: ${userId}`, {
            error: error.message,
            stack: error.stack,
            sessionId,
            userId,
            method: request.method,
            url: request.originalUrl,
            requestId,
          });
        },
      });
      
      return response;
      
    } catch (error) {
      this.logger.error('Unhandled error in chat service', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId,
        method: request.method,
        url: request.originalUrl,
        requestId,
      });
      
      throw error;
    }
  }
}