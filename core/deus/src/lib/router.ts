/**
 * Deus Agent - Smart Router
 * Uses LLM-based routing via Vercel AI SDK or web app
 */

import { generateText, Output, zodSchema } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { DEUS_SYSTEM_PROMPT } from './system-prompt.js';
import { loadAuthConfig } from './config/profile-config.js';

export interface DeusResponse {
  response: string;
  action?: DeusAction;
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
    const decision = await this.route(userMessage);

    if (!decision) {
      // Fallback response
      const fallback = "I'm not sure how to help with that. Can you clarify what you need?";
      this.conversationHistory.push({
        role: 'assistant',
        content: fallback,
      });
      return { response: fallback };
    }

    const response = `I'll start ${decision.agent} to help. ${decision.reasoning}`;

    this.conversationHistory.push({
      role: 'assistant',
      content: response,
    });

    return {
      response,
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
  private async route(message: string): Promise<RouteDecision | null> {
    const authConfig = loadAuthConfig();

    // Try web app routing if authenticated
    if (authConfig.apiKey && authConfig.defaultOrgSlug && this.sessionId) {
      try {
        if (process.env.DEBUG) {
          console.log('[Deus Router] Routing via web app...');
        }
        return await this.routeViaWebApp(message, authConfig);
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
    return await this.routeWithLLM(message);
  }

  /**
   * Route via web app API
   */
  private async routeViaWebApp(
    message: string,
    authConfig: typeof loadAuthConfig extends () => infer R ? R : never
  ): Promise<RouteDecision | null> {
    const response = await fetch(
      `${authConfig.apiUrl}/api/chat/${authConfig.defaultOrgSlug}/${this.sessionId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      }
    );

    if (!response.ok) {
      throw new Error(`Router API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as WebAppRouterResponse;

    return {
      agent: data.agent,
      mcpServers: data.mcpServers,
      reasoning: data.reasoning,
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
