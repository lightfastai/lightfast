/**
 * Root Controller
 * 
 * Handles the root endpoint and provides API documentation.
 */

import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  
  @Get()
  getApiInfo() {
    const PORT = process.env.PORT || 3005;
    
    return {
      name: 'Lightfast Multi-Backend Chat - NestJS',
      version: '1.0.0',
      backend: 'nestjs',
      framework: 'NestJS',
      endpoints: {
        chat: 'POST /api/chat/{sessionId}',
        health: 'GET /health',
      },
      examples: {
        curl: `curl -X POST http://localhost:${PORT}/api/chat/test-session \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`,
      },
      features: [
        'Enterprise-grade architecture',
        'Dependency injection',
        'Built-in guards and interceptors',
        'Extensive documentation',
        'Testing utilities',
        'TypeScript first',
      ],
    };
  }
}