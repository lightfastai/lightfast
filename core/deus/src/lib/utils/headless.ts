import { Orchestrator, type ActiveAgent, type OrchestratorState } from '../orchestrator.js';
import type { AgentType } from '../../types/index.js';

export interface HeadlessOptions {
  agent?: AgentType; // Optional: bypass Deus routing and go directly to agent
  message: string;
  json?: boolean;
  timeout?: number; // ms to wait for response
}

export interface HeadlessResult {
  success: boolean;
  routedTo?: ActiveAgent; // Which agent Deus selected (or direct if bypassed)
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
    agent: ActiveAgent;
  }>;
  error?: string;
}

/**
 * Run Deus in headless mode - single message interaction with smart routing
 */
export async function runHeadless(options: HeadlessOptions): Promise<HeadlessResult> {
  const orchestrator = new Orchestrator();
  const timeout = options.timeout ?? 30000; // 30s default

  let completed = false;
  let previousActiveAgent: ActiveAgent = 'deus';
  const result: HeadlessResult = {
    success: false,
    messages: [],
  };

  // Subscribe to state changes
  const unsubscribe = orchestrator.subscribe((state: OrchestratorState) => {
    if (process.env.DEBUG) {
      console.log(`[Headless] State update: activeAgent=${state.activeAgent}, messages=${state.messages.length}`);
    }

    // Collect all messages
    result.messages = state.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      agent: msg.agent,
    }));

    // Track which agent we routed to (first non-deus agent)
    if (state.activeAgent !== 'deus' && !result.routedTo) {
      result.routedTo = state.activeAgent;
      if (process.env.DEBUG) {
        console.log(`[Headless] Routed to ${state.activeAgent}`);
      }
    }

    // Check if we returned to Deus (task completed)
    if (previousActiveAgent !== 'deus' && state.activeAgent === 'deus') {
      if (process.env.DEBUG) {
        console.log('[Headless] Returned to Deus - task completed');
      }
      completed = true;
    }

    previousActiveAgent = state.activeAgent;
  });

  try {
    // Initialize orchestrator
    await orchestrator.initialize();

    if (process.env.DEBUG) {
      const mode = options.agent ? `direct to ${options.agent}` : 'via Deus routing';
      console.log(`[Headless] Sending message (${mode}): "${options.message}"`);
    }

    // If agent specified, bypass Deus routing (legacy mode)
    if (options.agent) {
      if (process.env.DEBUG) {
        console.log(`[Headless] Legacy mode: bypassing Deus, starting ${options.agent} directly`);
      }

      // Manually start the agent (this bypasses Deus router)
      const agent = options.agent;
      result.routedTo = agent;

      // Create a mock Deus action to start the agent
      const mockAction = {
        type: agent === 'claude-code' ? 'start-claude-code' as const : 'start-codex' as const,
        config: {
          jobType: 'direct-headless',
          prompt: options.message,
          mcpServers: [] as string[],
        },
      };

      // Use the private startAgent method via type casting
      await (orchestrator as any).startAgent(mockAction);
    } else {
      // New mode: Let Deus route the message
      await orchestrator.handleUserMessage(options.message);
    }

    // Wait for completion or timeout
    const startTime = Date.now();
    while (!completed && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));

      // Alternative completion check: if we got a response and stayed on Deus
      if (!result.routedTo && result.messages.length > 2) {
        // Deus handled it directly without routing
        completed = true;
      }
    }

    if (!completed) {
      result.error = 'Timeout waiting for response';
    } else {
      result.success = !result.error;
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    unsubscribe();
    await orchestrator.cleanup();
  }
}

/**
 * Format headless result for console output
 */
export function formatHeadlessOutput(result: HeadlessResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  // Human-readable format
  const lines: string[] = [];

  if (result.error) {
    lines.push(`❌ Error: ${result.error}`);
  } else {
    lines.push('✅ Success');
  }

  // Show routing decision
  if (result.routedTo) {
    const agentName = result.routedTo === 'deus' ? 'Deus'
      : result.routedTo === 'claude-code' ? 'Claude Code'
      : 'Codex';
    lines.push(`🎯 Routed to: ${agentName}`);
  }

  lines.push('');
  lines.push('Messages:');
  lines.push('─'.repeat(50));

  for (const msg of result.messages) {
    const icon = msg.role === 'user' ? '→' : msg.role === 'assistant' ? '←' : '•';
    const role = msg.role.toUpperCase().padEnd(10);
    const agent = msg.agent ? ` [${msg.agent}]` : '';
    lines.push(`${icon} ${role}${agent} ${msg.content}`);
    lines.push('');
  }

  return lines.join('\n');
}
