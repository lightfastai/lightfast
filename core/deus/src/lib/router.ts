/**
 * Deus Agent - Smart Router
 * Uses LLM-based routing via Vercel AI SDK or web app
 */

import type { LightfastAppDeusUIMessage } from '@repo/deus-types';
import { generateText, Output, zodSchema } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { DEUS_SYSTEM_PROMPT } from './system-prompt.js';
import { loadConfig, getApiUrl } from './config/config.js';
import { routeViaWebAppStreaming } from './router-streaming.js';

export interface DeusResponse {
  response: string;
  action?: DeusAction;
  message?: LightfastAppDeusUIMessage;
}

export interface DeusAction {
  type: 'start-claude-code' | 'start-codex';
  config: {
    jobType: string;
    mcpServers: string[];
    prompt: string;
  };
}

const routeDecisionSchema = z.object({
  agent: z.enum(['claude-code', 'codex']),
  mcpServers: z.array(z.string()),
  reasoning: z.string(),
});

type RouteDecision = z.infer<typeof routeDecisionSchema>;

/**
 * Web app router response
 */
interface WebAppRouterResponse {
  agent: 'claude-code' | 'codex';
  mcpServers: string[];
  reasoning: string;
  response?: string;
}

export class DeusAgent {
  private conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];
  private sessionId: string | null = null;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || null;
  }

  async processMessage(userMessage: string): Promise<DeusResponse> {
    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Route with web app or LLM
    const result = await this.route(userMessage);

    if (!result || !result.decision) {
      // Fallback response
      const fallback = "I'm not sure how to help with that. Can you clarify what you need?";
      this.conversationHistory.push({
        role: 'assistant',
        content: fallback,
      });
      return { response: fallback, message: result?.message };
    }

    const { decision, message } = result;
    const response = `I'll start ${decision.agent} to help. ${decision.reasoning}`;

    this.conversationHistory.push({
      role: 'assistant',
      content: response,
    });

    return {
      response,
      message,
      action: {
        type: decision.agent === 'claude-code' ? 'start-claude-code' : 'start-codex',
        config: {
          jobType: 'general',
          mcpServers: decision.mcpServers,
          prompt: userMessage,
        },
      },
    };
  }

  /**
   * Route message via web app or local LLM
   */
  private async route(message: string): Promise<{ decision: RouteDecision | null; message?: LightfastAppDeusUIMessage } | null> {
    const config = loadConfig();
    const apiUrl = getApiUrl();

    // Try web app routing if authenticated
    if (config.apiKey && config.defaultOrgSlug && this.sessionId) {
      try {
        if (process.env.DEBUG) {
          console.log('[Deus Router] Routing via web app...');
        }
        return await this.routeViaWebApp(message, { ...config, apiUrl });
      } catch (error) {
        if (process.env.DEBUG) {
          console.error(
            '[Deus Router] Web app routing failed, falling back to local:',
            error instanceof Error ? error.message : String(error)
          );
        }
        // Fall through to local routing
      }
    }

    // Fallback to local LLM routing
    if (process.env.DEBUG) {
      console.log('[Deus Router] Routing via local LLM...');
    }
    const decision = await this.routeWithLLM(message);
    return decision ? { decision } : null;
  }

  /**
   * Route via web app API with streaming and user confirmation
   */
  private async routeViaWebApp(
    message: string,
    authConfig: ReturnType<typeof loadConfig> & { apiUrl: string }
  ): Promise<{ decision: RouteDecision | null; message: LightfastAppDeusUIMessage }> {
    if (!this.sessionId) {
      throw new Error('Session ID is required for web app routing');
    }

    // Use streaming handler which prompts for user confirmation
    const result = await routeViaWebAppStreaming(message, this.sessionId);

    const routeDecision = result.decision ? {
      agent: result.decision.agent,
      mcpServers: result.decision.mcpServers,
      reasoning: result.decision.reasoning || `Starting ${result.decision.agent} for task: ${result.decision.task}`,
    } : null;

    return {
      decision: routeDecision,
      message: result.message,
    };
  }

  /**
   * Route with local LLM (fallback)
   */
  private async routeWithLLM(message: string): Promise<RouteDecision | null> {
    try {
      const result = await generateText({
        model: gateway('anthropic/claude-sonnet-4.5'),
        system: DEUS_SYSTEM_PROMPT,
        prompt: message,
        temperature: 0.2,
        experimental_output: Output.object({
          schema: zodSchema(routeDecisionSchema),
        }),
      });

      return result.experimental_output;
    } catch (error) {
      console.error('[Deus Router] LLM error:', error);
      return null;
    }
  }

  getHistory() {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Add a system message to conversation history
   * Used for tracking agent state transitions
   */
  addSystemMessage(message: string): void {
    this.conversationHistory.push({
      role: 'assistant',
      content: message,
    });
  }
}
