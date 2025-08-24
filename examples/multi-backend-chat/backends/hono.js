/**
 * Hono Backend
 * 
 * This backend demonstrates using Lightfast with Hono,
 * a fast and lightweight web framework that works on multiple runtimes.
 */

const { Hono } = require('hono');
const { cors } = require('hono/cors');
const { logger } = require('hono/logger');
const { serve } = require('@hono/node-server');
const { fetchRequestHandler } = require('lightfast/server/adapters/fetch');
const {
  createChatAgent,
  createMemory,
  generateRequestId,
} = require('../shared/agent-config');

const PORT = process.env.PORT || 3003;

// Create Hono app
const app = new Hono();

// Create memory instance (shared across requests)
const memory = createMemory();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Custom middleware to add request ID
app.use('*', async (c, next) => {
  const requestId = generateRequestId();
  c.set('requestId', requestId);
  await next();
});

/**
 * Chat API endpoint
 * POST /api/chat/:sessionId
 */
app.post('/api/chat/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const requestId = c.get('requestId');
  
  try {
    // Validate session ID
    if (!sessionId) {
      return c.json({
        error: 'Invalid path',
        message: 'sessionId is required',
        requestId,
      }, 400);
    }
    
    // Create userId for this session
    const userId = `user_${sessionId}`;
    
    // Create agent
    const agent = createChatAgent({ sessionId, userId });
    
    // Get the original Request object from Hono context
    const fetchRequest = c.req.raw;
    
    // Use fetchRequestHandler
    const response = await fetchRequestHandler({
      agent,
      sessionId,
      memory,
      req: fetchRequest,
      resourceId: userId,
      context: {
        modelId: 'openai/gpt-5-nano',
        backend: 'hono',
      },
      createRequestContext: (req) => ({
        userAgent: req.headers.get('user-agent') ?? undefined,
        ipAddress: req.headers.get('x-forwarded-for') ?? 
                  req.headers.get('x-real-ip') ?? 
                  req.headers.get('cf-connecting-ip') ?? // Cloudflare
                  undefined,
      }),
      generateId: generateRequestId,
      enableResume: true,
      onError({ error }) {
        console.error(`[Hono Error] Session: ${sessionId}, User: ${userId}`, {
          error: error.message,
          stack: error.stack,
          sessionId,
          userId,
          method: c.req.method,
          url: c.req.url,
          requestId,
        });
      },
    });
    
    // Return the response directly (Hono handles Fetch Response objects natively)
    return response;
    
  } catch (error) {
    console.error(`[Hono Error] Unhandled error:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      sessionId,
      method: c.req.method,
      url: c.req.url,
      requestId,
    });
    
    return c.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      requestId,
    }, 500);
  }
});

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    backend: 'hono',
    timestamp: new Date().toISOString(),
    version: process.version,
    honoVersion: require('hono/package.json').version,
    runtime: 'node',
  });
});

/**
 * Root endpoint with API documentation
 * GET /
 */
app.get('/', (c) => {
  return c.json({
    name: 'Lightfast Multi-Backend Chat - Hono',
    version: '1.0.0',
    backend: 'hono',
    runtime: 'node',
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
      'Fast and lightweight',
      'Multi-runtime support',
      'Native Fetch API support',
      'Built-in streaming',
    ],
  });
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: 'Endpoint not found',
    availableEndpoints: [
      'POST /api/chat/{sessionId}',
      'GET /health',
      'GET /',
    ],
  }, 404);
});

/**
 * Error handler
 */
app.onError((error, c) => {
  console.error('[Hono Global Error]', {
    error: error.message,
    stack: error.stack,
    method: c.req.method,
    url: c.req.url,
    requestId: c.get('requestId'),
  });
  
  return c.json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    requestId: c.get('requestId'),
  }, 500);
});

// Start server using @hono/node-server
const server = serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`🚀 Hono Server running on http://localhost:${PORT}`);
console.log(`📊 Health check: http://localhost:${PORT}/health`);
console.log(`💬 Chat API: http://localhost:${PORT}/api/chat/{sessionId}`);
console.log(`📖 API docs: http://localhost:${PORT}/`);
console.log('');
console.log('Hono features:');
console.log('- ⚡ Ultra-fast performance');
console.log('- 🌐 Multi-runtime support (Node.js, Cloudflare Workers, etc.)');
console.log('- 🔄 Native Fetch API support');
console.log('- 📦 Small bundle size');
console.log('');
console.log('Example usage:');
console.log(`curl -X POST http://localhost:${PORT}/api/chat/test-session \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Hono server...');
  if (server && typeof server.close === 'function') {
    server.close(() => {
      console.log('✅ Server stopped gracefully');
      process.exit(0);
    });
  } else {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  if (server && typeof server.close === 'function') {
    server.close(() => {
      console.log('✅ Server stopped gracefully');
      process.exit(0);
    });
  } else {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  }
});