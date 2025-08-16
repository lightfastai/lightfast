/**
 * Express.js Backend
 * 
 * This backend demonstrates using Lightfast with Express.js,
 * showing how to integrate with the popular Node.js web framework.
 */

const express = require('express');
const cors = require('cors');
const { fetchRequestHandler } = require('@lightfastai/core/server/adapters/fetch');
const {
  createChatAgent,
  createMemory,
  generateRequestId,
  createErrorResponse,
} = require('../shared/agent-config');

const PORT = process.env.PORT || 3002;

// Create Express app
const app = express();

// Create memory instance (shared across requests)
const memory = createMemory();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON bodies
app.use(express.raw({ type: 'application/octet-stream' })); // Handle binary data

// Request logging middleware
app.use((req, res, next) => {
  const requestId = generateRequestId();
  req.requestId = requestId;
  console.log(`[Express] ${req.method} ${req.path} - ${requestId}`);
  next();
});

/**
 * Convert Express request to Fetch API Request
 * @param {express.Request} req - Express request
 * @returns {Request} Fetch API Request
 */
function expressToFetchRequest(req) {
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else if (value) {
      headers.set(key, value);
    }
  });
  
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  
  return new Request(url, {
    method: req.method,
    headers,
    body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined,
  });
}

/**
 * Chat API endpoint
 * POST /api/chat/:sessionId
 */
app.post('/api/chat/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const requestId = req.requestId;
  
  try {
    // Validate session ID
    if (!sessionId) {
      return res.status(400).json({
        error: 'Invalid path',
        message: 'sessionId is required',
        requestId,
      });
    }
    
    // Create userId for this session
    const userId = `user_${sessionId}`;
    
    // Create agent
    const agent = createChatAgent({ sessionId, userId });
    
    // Convert Express request to Fetch API Request
    const fetchRequest = expressToFetchRequest(req);
    
    // Use fetchRequestHandler
    const response = await fetchRequestHandler({
      agent,
      sessionId,
      memory,
      req: fetchRequest,
      resourceId: userId,
      context: {
        modelId: 'openai/gpt-5-nano',
        backend: 'express',
      },
      createRequestContext: (req) => ({
        userAgent: req.headers.get('user-agent') ?? undefined,
        ipAddress: req.headers.get('x-forwarded-for') ?? 
                  req.headers.get('x-real-ip') ?? 
                  undefined,
      }),
      generateId: generateRequestId,
      enableResume: true,
      onError({ error }) {
        console.error(`[Express Error] Session: ${sessionId}, User: ${userId}`, {
          error: error.message,
          stack: error.stack,
          sessionId,
          userId,
          method: req.method,
          url: req.originalUrl,
          requestId,
        });
      },
    });
    
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
    console.error(`[Express Error] Unhandled error:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      sessionId,
      method: req.method,
      url: req.originalUrl,
      requestId,
    });
    
    res.status(500).json({
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
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    backend: 'express',
    timestamp: new Date().toISOString(),
    version: process.version,
    expressVersion: require('express/package.json').version,
  });
});

/**
 * Root endpoint with API documentation
 * GET /
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Lightfast Multi-Backend Chat - Express',
    version: '1.0.0',
    backend: 'express',
    endpoints: {
      chat: 'POST /api/chat/{sessionId}',
      health: 'GET /health',
    },
    examples: {
      curl: `curl -X POST http://localhost:${PORT}/api/chat/test-session \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`,
    },
  });
});

/**
 * 404 handler
 */
app.use('*', (req, res) => {
  res.status(404).json({
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
app.use((error, req, res, next) => {
  console.error('[Express Global Error]', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    requestId: req.requestId,
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    requestId: req.requestId,
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Express Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat/{sessionId}`);
  console.log(`📖 API docs: http://localhost:${PORT}/`);
  console.log('');
  console.log('Example usage:');
  console.log(`curl -X POST http://localhost:${PORT}/api/chat/test-session \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Express server...');
  server.close(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});