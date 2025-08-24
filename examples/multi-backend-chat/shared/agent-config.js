/**
 * Shared Agent Configuration for Multi-Backend Chat Example
 * 
 * This configuration is used by all backend implementations to ensure
 * consistent agent behavior across different frameworks.
 */

const { gateway } = require("@ai-sdk/gateway");
const { createAgent } = require("lightfast/agent");
const { RedisMemory } = require("lightfast/memory/adapters/redis");
const { tool } = require("lightfast/tools");
const { z } = require("zod");

// Model configuration
const MODEL = "openai/gpt-5-nano";

// Weather tool implementation (example from docs)
const weatherTool = tool({
  description: "Get the current weather in a location",
  inputSchema: z.object({
    location: z.string().describe("The location to get weather for"),
  }),
  execute: async ({ location }) => {
    // Simulate weather API call
    const weather = {
      location,
      temperature: Math.floor(Math.random() * 30) + 10, // 10-40°C
      condition: ["sunny", "cloudy", "rainy", "partly cloudy"][Math.floor(Math.random() * 4)],
      humidity: Math.floor(Math.random() * 50) + 30, // 30-80%
    };
    
    return `Weather in ${location}: ${weather.temperature}°C, ${weather.condition}, ${weather.humidity}% humidity`;
  },
});

// Calculator tool implementation
const calculatorTool = tool({
  description: "Perform basic mathematical calculations",
  inputSchema: z.object({
    expression: z.string().describe("The mathematical expression to evaluate (e.g., '2 + 3 * 4')"),
  }),
  execute: async ({ expression }) => {
    try {
      // Simple and safe expression evaluation
      // This is a basic implementation - in production you'd want a proper math parser
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return `${expression} = ${result}`;
    } catch (error) {
      return `Error calculating "${expression}": Invalid expression`;
    }
  },
});

// Tools collection
const chatTools = {
  weather: weatherTool,
  calculator: calculatorTool,
};

/**
 * Create a configured agent instance
 * @param {Object} options - Configuration options
 * @param {string} options.sessionId - Session identifier
 * @param {string} options.userId - User identifier
 * @returns {Object} Configured agent
 */
function createChatAgent({ sessionId, userId }) {
  return createAgent({
    name: "assistant",
    system: `You are a helpful AI assistant powered by Lightfast Core infrastructure.

This is a multi-backend chat example demonstrating how the same agent configuration
can be used across different backend frameworks (Node.js HTTP, Express, Hono, Fastify, NestJS).

Available tools:
- weather: Get current weather for any location
- calculator: Perform mathematical calculations

Key features:
- Agent orchestration with createAgent
- Memory persistence with Redis (when configured)
- Tool execution capabilities
- Streaming responses with proper error handling
- Request tracking and telemetry

Be concise, helpful, and friendly in your responses. When asked about weather or calculations, use the appropriate tools.`,
    
    tools: chatTools,
    
    createRuntimeContext: ({
      sessionId: _sessionId,
      resourceId: _resourceId,
    }) => ({
      userId,
      sessionId,
    }),
    
    model: gateway(MODEL),
    
    onChunk: ({ chunk }) => {
      if ("type" in chunk && chunk.type === "tool-call") {
        console.log("Tool called:", chunk);
      }
    },
    
    onFinish: (result) => {
      console.log("Chat finished:", {
        sessionId,
        userId,
        finishReason: result.finishReason,
        usage: result.usage,
      });
    },
  });
}

/**
 * Create memory instance with fallback to in-memory
 * @returns {Object} Memory instance
 */
function createMemory() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (redisUrl && redisToken) {
    console.log("Using Redis memory storage");
    return new RedisMemory({
      url: redisUrl,
      token: redisToken,
    });
  } else {
    console.log("Redis not configured, using in-memory storage (conversations won't persist)");
    // Return a simple in-memory implementation
    const memoryStore = new Map();
    return {
      async get(key) {
        return memoryStore.get(key) || [];
      },
      async set(key, value) {
        memoryStore.set(key, value);
      },
      async delete(key) {
        memoryStore.delete(key);
      },
    };
  }
}

/**
 * Generate a unique request ID
 * @returns {string} UUID-like request ID
 */
function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Create CORS headers for cross-origin requests
 * @returns {Object} CORS headers
 */
function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight requests
 * @param {string} method - HTTP method
 * @returns {Response|null} CORS response or null if not needed
 */
function handleCors(method) {
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: createCorsHeaders(),
    });
  }
  return null;
}

/**
 * Create error response with consistent format
 * @param {string} error - Error type
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} requestId - Request identifier
 * @returns {Response} Error response
 */
function createErrorResponse(error, message, status = 500, requestId) {
  return new Response(
    JSON.stringify({
      error,
      message,
      requestId,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...createCorsHeaders(),
      },
    }
  );
}

module.exports = {
  MODEL,
  chatTools,
  createChatAgent,
  createMemory,
  generateRequestId,
  createCorsHeaders,
  handleCors,
  createErrorResponse,
};