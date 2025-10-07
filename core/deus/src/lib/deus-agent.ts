/**
 * Deus Agent - Smart Router
 * Makes decisions about which agent to use for a task
 *
 * For now: Uses mocked routing logic (pattern matching)
 * Future: Connect to LLM for intelligent routing
 */

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

/**
 * Mock routing patterns
 * Maps user intent to agent configuration
 *
 * Note: MCP servers listed here are optional - if .mcp.json doesn't exist or
 * doesn't contain these servers, they'll be gracefully skipped
 */
const ROUTING_PATTERNS = [
  {
    keywords: ['review', 'code review', 'check code', 'audit'],
    jobType: 'code-review',
    agent: 'claude-code' as const,
    mcpServers: [], // No MCPs required for basic code review
    response: "I'll start Claude Code to review the code.",
  },
  {
    keywords: ['test', 'testing', 'write tests', 'unit test'],
    jobType: 'testing',
    agent: 'codex' as const,
    mcpServers: [], // No MCPs required for basic testing
    response: "I'll start Codex to help with testing.",
  },
  {
    keywords: ['debug', 'fix bug', 'error', 'troubleshoot'],
    jobType: 'debugging',
    agent: 'claude-code' as const,
    mcpServers: [],
    response: "I'll start Claude Code to help debug the issue.",
  },
  {
    keywords: ['refactor', 'clean up', 'improve code', 'optimize'],
    jobType: 'refactoring',
    agent: 'claude-code' as const,
    mcpServers: [],
    response: "I'll start Claude Code to help with refactoring.",
  },
  {
    keywords: ['web', 'browse', 'scrape', 'browser', 'playwright'],
    jobType: 'web-automation',
    agent: 'codex' as const,
    mcpServers: ['playwright', 'browserbase'], // Optional MCPs
    response: "I'll start Codex with browser automation tools.",
  },
  {
    keywords: ['document', 'docs', 'readme', 'write documentation'],
    jobType: 'documentation',
    agent: 'claude-code' as const,
    mcpServers: [],
    response: "I'll start Claude Code to help with documentation.",
  },
];

/**
 * Deus Agent
 * Smart router that decides which agent to use
 */
export class DeusAgent {
  private conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> = [];

  /**
   * Process user message and decide action
   */
  async processMessage(userMessage: string): Promise<DeusResponse> {
    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Check for explicit commands first
    const command = this.parseCommand(userMessage);
    if (command) {
      return this.handleCommand(command);
    }

    // Try to match routing patterns
    const route = this.matchRoutingPattern(userMessage);
    if (route) {
      const response = route.response;

      // Add to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      });

      return {
        response,
        action: {
          type: route.agent === 'claude-code' ? 'start-claude-code' : 'start-codex',
          config: {
            jobType: route.jobType,
            mcpServers: route.mcpServers,
            prompt: userMessage,
          },
        },
      };
    }

    // Default response (no action)
    const response = this.generateDefaultResponse(userMessage);

    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });

    return { response };
  }

  /**
   * Parse explicit commands like "start code-review"
   */
  private parseCommand(message: string): {
    command: string;
    args?: string[];
  } | null {
    const lower = message.toLowerCase().trim();

    // "start <job-type>"
    const startMatch = lower.match(/^start\s+(.+)$/);
    if (startMatch) {
      return {
        command: 'start',
        args: [startMatch[1]!],
      };
    }

    // "help"
    if (lower === 'help' || lower === '?') {
      return { command: 'help' };
    }

    // "status"
    if (lower === 'status') {
      return { command: 'status' };
    }

    return null;
  }

  /**
   * Handle explicit commands
   */
  private handleCommand(command: { command: string; args?: string[] }): DeusResponse {
    switch (command.command) {
      case 'help':
        return {
          response: this.getHelpMessage(),
        };

      case 'status':
        return {
          response: this.getStatusMessage(),
        };

      case 'start': {
        const jobType = command.args?.[0];
        if (!jobType) {
          return {
            response: 'Please specify a job type. Example: "start code-review"',
          };
        }

        // Try to match job type to a pattern
        const route = ROUTING_PATTERNS.find(p =>
          p.jobType === jobType || p.keywords.some(k => k.includes(jobType))
        );

        if (route) {
          return {
            response: route.response,
            action: {
              type: route.agent === 'claude-code' ? 'start-claude-code' : 'start-codex',
              config: {
                jobType: route.jobType,
                mcpServers: route.mcpServers,
                prompt: `Start ${jobType} task`,
              },
            },
          };
        }

        // Default to Claude Code if no match
        return {
          response: `Starting Claude Code for ${jobType}...`,
          action: {
            type: 'start-claude-code',
            config: {
              jobType,
              mcpServers: ['deus-session', 'filesystem'],
              prompt: `Start ${jobType} task`,
            },
          },
        };
      }

      default:
        return {
          response: "I don't understand that command. Type 'help' for available commands.",
        };
    }
  }

  /**
   * Match user message to routing pattern
   */
  private matchRoutingPattern(message: string): typeof ROUTING_PATTERNS[0] | null {
    const lower = message.toLowerCase();

    for (const pattern of ROUTING_PATTERNS) {
      if (pattern.keywords.some(keyword => lower.includes(keyword))) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Generate default response when no pattern matches
   */
  private generateDefaultResponse(message: string): string {
    // Simple responses for common queries
    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      return "Hello! I'm Deus, your AI orchestrator. Tell me what you'd like help with.";
    }

    if (message.toLowerCase().includes('what can you do')) {
      return this.getHelpMessage();
    }

    // Generic response
    return [
      "I'm Deus, an AI orchestrator that routes tasks to the right agent.",
      "",
      "Tell me what you need help with, and I'll start the appropriate agent:",
      "• Code review → Claude Code",
      "• Testing → Codex with Playwright",
      "• Debugging → Claude Code",
      "• Web automation → Codex with Browserbase",
      "",
      "Or type 'help' to see all available options.",
    ].join('\n');
  }

  /**
   * Get help message
   */
  private getHelpMessage(): string {
    return [
      "=== Deus Orchestrator ===",
      "",
      "I route tasks to the right agent. Here's what I can do:",
      "",
      "TASKS:",
      "• Code review → Starts Claude Code",
      "• Testing → Starts Codex with Playwright",
      "• Debugging → Starts Claude Code",
      "• Refactoring → Starts Claude Code",
      "• Web automation → Starts Codex with Browserbase",
      "• Documentation → Starts Claude Code",
      "",
      "COMMANDS:",
      "• start <job-type> → Explicitly start a job",
      "• status → Show current status",
      "• help → Show this message",
      "",
      "EXAMPLES:",
      "• \"Review the authentication code\"",
      "• \"Help me write tests for the API\"",
      "• \"start code-review\"",
      "",
      "Just tell me what you need, and I'll handle the rest!",
    ].join('\n');
  }

  /**
   * Get status message
   */
  private getStatusMessage(): string {
    return [
      "=== Deus Status ===",
      "",
      `Conversation turns: ${this.conversationHistory.length / 2}`,
      `Active: Deus (Router)`,
      "",
      "Ready to route tasks to Claude Code or Codex.",
      "Tell me what you need help with!",
    ].join('\n');
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Add system message to history
   */
  addSystemMessage(content: string) {
    this.conversationHistory.push({
      role: 'assistant',
      content: `[System] ${content}`,
      timestamp: new Date(),
    });
  }
}

/**
 * Future: LLM-based routing
 *
 * When ready to connect to an LLM, replace matchRoutingPattern with:
 *
 * async routeWithLLM(message: string): Promise<DeusAction | null> {
 *   const systemPrompt = `You are Deus, an AI orchestrator.
 *   Analyze the user's request and decide which agent to use:
 *   - Claude Code: For code review, debugging, refactoring, documentation
 *   - Codex: For testing, web automation, browser tasks
 *
 *   Return JSON with: { agent: "claude-code" | "codex", jobType: string, mcpServers: string[] }
 *   `;
 *
 *   const llmResponse = await callLLM({
 *     system: systemPrompt,
 *     messages: this.conversationHistory,
 *     userMessage: message,
 *   });
 *
 *   const decision = JSON.parse(llmResponse);
 *
 *   return {
 *     type: decision.agent === 'claude-code' ? 'start-claude-code' : 'start-codex',
 *     config: {
 *       jobType: decision.jobType,
 *       mcpServers: decision.mcpServers,
 *       prompt: message,
 *     },
 *   };
 * }
 */
