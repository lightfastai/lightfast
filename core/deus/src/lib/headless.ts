import { Orchestrator } from './orchestrator.js';
import type { AgentType, OrchestrationState } from '../types/index.js';

export interface HeadlessOptions {
  agent?: AgentType;
  message: string;
  json?: boolean;
  timeout?: number; // ms to wait for response
}

export interface HeadlessResult {
  success: boolean;
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
  }>;
  error?: string;
}

/**
 * Run Deus in headless mode - single message interaction
 */
export async function runHeadless(options: HeadlessOptions): Promise<HeadlessResult> {
  const orchestrator = new Orchestrator();
  const agent = options.agent ?? 'claude-code';
  const timeout = options.timeout ?? 30000; // 30s default

  let completed = false;
  const result: HeadlessResult = {
    success: false,
    messages: [],
  };

  // Subscribe to state changes
  const unsubscribe = orchestrator.subscribe((state: OrchestrationState) => {
    const agentState = agent === 'claude-code' ? state.claudeCode : state.codex;

    // Collect messages
    result.messages = agentState.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // Check if agent completed (went back to idle after running)
    if (agentState.status === 'idle' && result.messages.length > 1) {
      completed = true;
    }

    // Check for errors
    if (agentState.status === 'error') {
      result.error = agentState.currentTask ?? 'Unknown error';
      completed = true;
    }
  });

  try {
    // Start the agent
    await orchestrator.startAgent(agent);

    // Wait a bit for agent to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send the message
    await orchestrator.sendToAgent(agent, options.message);

    // Wait for completion or timeout
    const startTime = Date.now();
    while (!completed && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
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

  lines.push('');
  lines.push('Messages:');
  lines.push('─'.repeat(50));

  for (const msg of result.messages) {
    const icon = msg.role === 'user' ? '→' : msg.role === 'assistant' ? '←' : '•';
    const role = msg.role.toUpperCase().padEnd(10);
    lines.push(`${icon} ${role} ${msg.content}`);
    lines.push('');
  }

  return lines.join('\n');
}
