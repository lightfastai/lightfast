/**
 * NestJS Application Entry Point
 * 
 * This file bootstraps the NestJS application for the Lightfast
 * Multi-Backend Chat Example.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const PORT = process.env.PORT || 3005;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
  
  // Global prefix (optional)
  app.setGlobalPrefix('api', { exclude: ['health', '/'] });
  
  await app.listen(PORT);
  
  console.log(`🚀 NestJS Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat/{sessionId}`);
  console.log(`📖 API docs: http://localhost:${PORT}/`);
  console.log('');
  console.log('NestJS features:');
  console.log('- 🏗️  Enterprise-grade architecture');
  console.log('- 💉 Dependency injection');
  console.log('- 🛡️  Built-in guards and interceptors');
  console.log('- 📚 Extensive documentation');
  console.log('- 🧪 Testing utilities');
  console.log('');
  console.log('Example usage:');
  console.log(`curl -X POST http://localhost:${PORT}/api/chat/test-session \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`);
}

bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});