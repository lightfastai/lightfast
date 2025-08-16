/**
 * Fastify Backend
 * 
 * This backend demonstrates using Lightfast with Fastify,
 * a fast and low overhead web framework for Node.js.
 */

const fastify = require('fastify');
const { fetchRequestHandler } = require('@lightfastai/core/server/adapters/fetch');
const {
  createChatAgent,
  createMemory,
  generateRequestId,
} = require('../shared/agent-config');

const PORT = process.env.PORT || 3004;

// Create Fastify instance
const app = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      }
    }
  }
});

// Create memory instance (shared across requests)
const memory = createMemory();

// Register CORS plugin
app.register(require('@fastify/cors'), {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Hook to add request ID
app.addHook('onRequest', async (request, reply) => {
  const requestId = generateRequestId();
  request.requestId = requestId;
});

/**
 * Convert Fastify request to Fetch API Request
 * @param {FastifyRequest} request - Fastify request
 * @returns {Request} Fetch API Request
 */
function fastifyToFetchRequest(request) {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else if (value) {
      headers.set(key, value);
    }
  });
  
  const url = `${request.protocol}://${request.hostname}${request.url}`;
  
  return new Request(url, {
    method: request.method,
    headers,
    body: request.body ? JSON.stringify(request.body) : undefined,
  });
}

/**
 * Chat API endpoint
 * POST /api/chat/:sessionId
 */
app.post('/api/chat/:sessionId', async (request, reply) => {
  const { sessionId } = request.params;
  const requestId = request.requestId;
  
  try {
    // Validate session ID
    if (!sessionId) {
      return reply.status(400).send({
        error: 'Invalid path',
        message: 'sessionId is required',
        requestId,
      });
    }
    
    // Create userId for this session
    const userId = `user_${sessionId}`;
    
    // Create agent
    const agent = createChatAgent({ sessionId, userId });
    
    // Convert Fastify request to Fetch API Request
    const fetchRequest = fastifyToFetchRequest(request);
    
    // Use fetchRequestHandler
    const response = await fetchRequestHandler({
      agent,
      sessionId,
      memory,
      req: fetchRequest,
      resourceId: userId,
      context: {
        modelId: 'openai/gpt-5-nano',
        backend: 'fastify',
      },
      createRequestContext: (req) => ({
        userAgent: req.headers.get('user-agent') ?? undefined,
        ipAddress: req.headers.get('x-forwarded-for') ?? 
                  req.headers.get('x-real-ip') ?? 
                  req.headers.get('x-forwarded-proto') ?? 
                  undefined,
      }),
      generateId: generateRequestId,
      enableResume: true,
      onError({ error }) {
        request.log.error({
          error: error.message,
          stack: error.stack,
          sessionId,
          userId,
          method: request.method,
          url: request.url,
          requestId,
        }, `Lightfast error in session ${sessionId}`);
      },
    });
    
    // Set response headers
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });
    
    // Set status code
    reply.status(response.status);
    
    // Stream response body
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    }
    
    reply.raw.end();
    
  } catch (error) {
    request.log.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      sessionId,
      method: request.method,
      url: request.url,
      requestId,
    }, 'Unhandled error in chat endpoint');
    
    reply.status(500).send({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      requestId,
    });
  }
});

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    backend: 'fastify',
    timestamp: new Date().toISOString(),
    version: process.version,
    fastifyVersion: fastify.version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
});

/**
 * Root endpoint with API documentation
 * GET /
 */
app.get('/', async (request, reply) => {
  return {
    name: 'Lightfast Multi-Backend Chat - Fastify',
    version: '1.0.0',
    backend: 'fastify',
    fastifyVersion: fastify.version,
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
      'High performance',
      'Low overhead',
      'Built-in validation',
      'Extensive plugin ecosystem',
      'TypeScript ready',
    ],
  };
});

/**
 * 404 handler
 */
app.setNotFoundHandler(async (request, reply) => {
  reply.status(404).send({
    error: 'Not found',
    message: 'Endpoint not found',
    availableEndpoints: [
      'POST /api/chat/{sessionId}',
      'GET /health',
      'GET /',
    ],
  });
});

/**
 * Global error handler
 */
app.setErrorHandler(async (error, request, reply) => {
  request.log.error({
    error: error.message,
    stack: error.stack,
    method: request.method,
    url: request.url,
    requestId: request.requestId,
  }, 'Global error handler');
  
  reply.status(500).send({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    requestId: request.requestId,
  });
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    
    console.log(`🚀 Fastify Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`💬 Chat API: http://localhost:${PORT}/api/chat/{sessionId}`);
    console.log(`📖 API docs: http://localhost:${PORT}/`);
    console.log('');
    console.log('Fastify features:');
    console.log('- ⚡ High performance');
    console.log('- 🪶 Low overhead');
    console.log('- ✅ Built-in validation');
    console.log('- 🔌 Rich plugin ecosystem');
    console.log('- 📘 TypeScript support');
    console.log('');
    console.log('Example usage:');
    console.log(`curl -X POST http://localhost:${PORT}/api/chat/test-session \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`);
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  app.log.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    await app.close();
    app.log.info('✅ Server stopped gracefully');
    process.exit(0);
  } catch (err) {
    app.log.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  app.log.fatal('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  app.log.fatal('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start();