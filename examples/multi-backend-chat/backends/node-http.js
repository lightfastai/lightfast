/**
 * Native Node.js HTTP Server Backend
 * 
 * This backend demonstrates using Lightfast with native Node.js HTTP server,
 * showing the minimal setup required without any framework dependencies.
 */

const http = require('http');
const url = require('url');
const { fetchRequestHandler } = require('lightfast/server/adapters/fetch');
const {
  createChatAgent,
  createMemory,
  generateRequestId,
  createCorsHeaders,
  handleCors,
  createErrorResponse,
} = require('../shared/agent-config');

const PORT = process.env.PORT || 3001;

// Create memory instance (shared across requests)
const memory = createMemory();

/**
 * Parse session ID from URL path
 * @param {string} pathname - URL pathname
 * @returns {string|null} Session ID or null if not found
 */
function parseSessionId(pathname) {
  const match = pathname.match(/^\/api\/chat\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Handle chat API requests
 * @param {http.IncomingMessage} req - Node.js request
 * @param {http.ServerResponse} res - Node.js response
 */
async function handleChatRequest(req, res) {
  const requestId = generateRequestId();
  
  try {
    // Parse URL and extract session ID
    const parsedUrl = url.parse(req.url, true);
    const sessionId = parseSessionId(parsedUrl.pathname);
    
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...createCorsHeaders() });
      res.end(JSON.stringify({
        error: 'Invalid path',
        message: 'sessionId is required in path /api/chat/{sessionId}',
        requestId,
      }));
      return;
    }
    
    // Create userId for this session
    const userId = `user_${sessionId}`;
    
    // Create agent
    const agent = createChatAgent({ sessionId, userId });
    
    // Convert Node.js request to Fetch API Request
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    });
    
    // Read request body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    
    // Create Fetch API Request
    const fetchRequest = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: body.length > 0 ? body : undefined,
    });
    
    // Use fetchRequestHandler
    const response = await fetchRequestHandler({
      agent,
      sessionId,
      memory,
      req: fetchRequest,
      resourceId: userId,
      context: {
        modelId: 'openai/gpt-5-nano',
        backend: 'node-http',
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
        console.error(`[Node.js HTTP Error] Session: ${sessionId}, User: ${userId}`, {
          error: error.message,
          stack: error.stack,
          sessionId,
          userId,
          method: req.method,
          url: req.url,
        });
      },
    });
    
    // Convert Fetch Response back to Node.js response
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers.entries()),
      ...createCorsHeaders(),
    });
    
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
    console.error(`[Node.js HTTP Error] Unhandled error:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      method: req.method,
      url: req.url,
    });
    
    res.writeHead(500, { 'Content-Type': 'application/json', ...createCorsHeaders() });
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      requestId,
    }));
  }
}

/**
 * Handle health check requests
 * @param {http.IncomingMessage} req - Node.js request
 * @param {http.ServerResponse} res - Node.js response
 */
function handleHealthCheck(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json', ...createCorsHeaders() });
  res.end(JSON.stringify({
    status: 'ok',
    backend: 'node-http',
    timestamp: new Date().toISOString(),
    version: process.version,
  }));
}

/**
 * Main request handler
 * @param {http.IncomingMessage} req - Node.js request
 * @param {http.ServerResponse} res - Node.js response
 */
async function requestHandler(req, res) {
  // Handle CORS preflight
  const corsResponse = handleCors(req.method);
  if (corsResponse) {
    res.writeHead(corsResponse.status, Object.fromEntries(corsResponse.headers.entries()));
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  
  // Route requests
  if (parsedUrl.pathname.startsWith('/api/chat/') && (req.method === 'POST' || req.method === 'GET')) {
    await handleChatRequest(req, res);
  } else if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    handleHealthCheck(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json', ...createCorsHeaders() });
    res.end(JSON.stringify({
      error: 'Not found',
      message: 'Endpoint not found',
      availableEndpoints: [
        'POST /api/chat/{sessionId}',
        'GET /health',
      ],
    }));
  }
}

// Create and start server
const server = http.createServer(requestHandler);

server.listen(PORT, () => {
  console.log(`🚀 Node.js HTTP Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat/{sessionId}`);
  console.log('');
  console.log('Example usage:');
  console.log(`curl -X POST http://localhost:${PORT}/api/chat/test-session \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Node.js HTTP server...');
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