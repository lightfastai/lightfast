/**
 * Streaming Router - Handles AI SDK streaming responses with tool calls
 *
 * This replaces the old JSON-based routing with proper streaming support
 * that handles client-side tool confirmation for run_coding_tool
 */

import type {
  LightfastAppDeusUIMessage,
  RunCodingToolInput,
} from '@repo/deus-types';
import { loadConfig, getApiUrl } from './config/config.js';
import { MessageAccumulator, parseStreamChunk } from './stream-parser.js';
import inquirer from 'inquirer';

export interface StreamingRouteDecision {
  agent: 'claude-code' | 'codex';
  mcpServers: string[];
  task: string;
  reasoning?: string;
}

export interface StreamingRouteResult {
  decision: StreamingRouteDecision | null;
  message: LightfastAppDeusUIMessage;
}

/**
 * Parse streaming response and handle tool calls
 * @returns Result containing both the decision and the complete message
 */
export async function routeViaWebAppStreaming(
  message: string,
  sessionId: string
): Promise<StreamingRouteResult> {
  const config = loadConfig();
  const apiUrl = getApiUrl();

  console.log('[Router] Starting streaming request...', {
    apiUrl,
    orgSlug: config.defaultOrgSlug,
    sessionId,
    message: message.slice(0, 50),
  });

  const response = await fetch(
    `${apiUrl}/api/chat/${config.defaultOrgSlug}/${sessionId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    }
  );

  console.log('[Router] Response received:', {
    status: response.status,
    contentType: response.headers.get('content-type'),
  });

  if (!response.ok) {
    throw new Error(`Router API error: ${response.status} ${response.statusText}`);
  }

  // Parse the streaming response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body');
  }

  const accumulator = new MessageAccumulator();
  let decision: StreamingRouteDecision | null = null;
  let chunkCount = 0;

  console.log('[Router] Starting to parse streaming response...');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[Router] Stream complete. Total chunks:', chunkCount);
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      chunkCount++;
      console.log(`[Router] Chunk ${chunkCount}:`, chunk.slice(0, 100));

      // Parse stream events
      const events = parseStreamChunk(chunk);

      for (const event of events) {
        // Process event with accumulator
        accumulator.processEvent(event);

        // Stream text to console in real-time
        if (event.type === 'text-delta') {
          process.stdout.write(event.delta);
        }

        // Handle tool calls with user confirmation
        if (event.type === 'tool-input-available' && event.toolName === 'run_coding_tool') {
          console.log('\n'); // New line before prompt
          console.log('[Router] Tool call detected (input available)');

          // Show confirmation and get decision
          decision = await handleToolCallWithArgs(
            event.input,
            apiUrl,
            config.defaultOrgSlug!,
            config.apiKey!,
            sessionId
          );
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log('\n'); // Final newline

  // Build the complete message
  const assistantMessage: LightfastAppDeusUIMessage = {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    parts: accumulator.getParts(),
    metadata: {
      createdAt: new Date().toISOString(),
      sessionId,
      agentType: 'deus',
    },
  };

  return {
    decision,
    message: assistantMessage,
  };
}

/**
 * Handle tool call with args (simpler version - no tool result sending)
 */
async function handleToolCallWithArgs(
  input: RunCodingToolInput,
  apiUrl: string,
  orgSlug: string,
  apiKey: string,
  sessionId: string
): Promise<StreamingRouteDecision | null> {
  if (process.env.DEBUG) {
    console.log('[Router] Handling tool call with args:', input);
  }

  // Show confirmation prompt
  console.log('\n╭─────────────────────────────────────────────────╮');
  console.log(`│ 🤖 Deus wants to start ${input.type.padEnd(23)} │`);
  console.log('│                                                 │');
  console.log(`│ Task: ${input.task.slice(0, 38).padEnd(38)}     │`);
  if (input.mcpServers && input.mcpServers.length > 0) {
    console.log(`│ MCP Servers: ${input.mcpServers.join(', ').slice(0, 30).padEnd(30)} │`);
  }
  console.log('│                                                 │');
  console.log('╰─────────────────────────────────────────────────╯\n');

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Start ${input.type}?`,
      default: true,
    },
  ]);

  if (!confirmed) {
    // User denied - just return null (no agent starts)
    console.log('❌ Cancelled by user\n');
    return null;
  }

  // User confirmed - return decision to start the agent
  // The execute function already ran on server and returned "completed"
  // Now we spawn the actual agent locally
  console.log(`✓ Starting ${input.type}...\n`);
  return {
    agent: input.type,
    mcpServers: input.mcpServers || [],
    task: input.task,
    reasoning: `Starting ${input.type} as confirmed by user`,
  };
}

