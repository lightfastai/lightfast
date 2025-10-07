/**
 * Deus Agent - Smart Router
 * Uses LLM-based routing via Vercel AI SDK
 */

import { generateText, output, zodSchema } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { DEUS_SYSTEM_PROMPT } from './system-prompt.js';

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

export class DeusAgent {
  private conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];

  async processMessage(userMessage: string): Promise<DeusResponse> {
    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Route with LLM
    const decision = await this.routeWithLLM(userMessage);

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

  private async routeWithLLM(message: string): Promise<RouteDecision | null> {
    try {
      const result = await generateText({
        model: gateway('anthropic/claude-sonnet-4.5'),
        system: DEUS_SYSTEM_PROMPT,
        prompt: message,
        temperature: 0.2,
        experimental_output: output.object({
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
}
