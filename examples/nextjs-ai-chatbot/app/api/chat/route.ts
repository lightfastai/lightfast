/**
 * Chat API Route using Lightfast Core v1
 * Uses Vercel AI Gateway for unified model access
 */

import { RedisMemory } from '@lightfast/core/memory';
import { streamText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { env } from '@/lib/env';

// Create memory adapter if Redis is configured
const memory = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new RedisMemory({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
  : undefined;

// Available models through the gateway
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', { status: 400 });
    }

    // Use the system prompt directly
    const systemPrompt = `You are a helpful AI assistant powered by Lightfast Core v1 infrastructure.
      
You have access to:
- Memory persistence for conversation history
- Tool execution capabilities
- Advanced language models

Be concise, helpful, and friendly in your responses.`;

    // Stream the response using gateway
    const result = await streamText({
      model: gateway(DEFAULT_MODEL),
      messages: [
        { 
          role: 'system', 
          content: systemPrompt
        },
        ...messages
      ],
      temperature: 0.7,
      onFinish: async ({ text }) => {
        // Store the conversation in memory if available
        if (memory && sessionId) {
          await memory.appendMessage({
            sessionId,
            message: {
              id: Date.now().toString(),
              role: 'assistant',
              content: text,
            },
            context: {},
          });
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred during the chat',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}