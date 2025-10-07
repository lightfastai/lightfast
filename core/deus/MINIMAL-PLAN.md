# Minimal Implementation Plan: LLM-Based Routing with Vercel AI SDK

## Goal
Get Deus routing working with Vercel AI SDK - simplest possible implementation.

## What We're Building
Replace pattern matching in `router.ts` with actual LLM routing using Vercel AI SDK.

## Minimal Architecture

```
User Message
    ↓
DeusAgent (LLM call via Vercel AI SDK)
    ↓
Returns: { agent: "claude-code" | "codex", mcpServers: [...] }
    ↓
Spawner (existing code - no changes)
```

## Implementation Steps

### 1. Install Dependencies
```bash
cd core/deus
pnpm add ai @ai-sdk/anthropic @ai-sdk/gateway
pnpm add -D dotenv-cli
```

### 2. Create System Prompt (Hardcoded)
**File**: `src/lib/system-prompt.ts`

```typescript
export const DEUS_SYSTEM_PROMPT = `You are Deus, an AI orchestrator that routes tasks to specialized agents.

Available agents:
- claude-code: Code review, debugging, refactoring, documentation, git operations
- codex: Testing, web automation, Playwright, browser tasks, E2E testing

Analyze the user's request and determine:
1. Which agent should handle this task
2. Which MCP servers are needed (if any)
3. Your reasoning for this decision

Available MCP servers:
- playwright: Browser automation
- browserbase: Cloud browser sessions
- deus-session: Session management (always included)

Examples:
- "Review the auth code" → agent: claude-code, mcpServers: [], reasoning: "Code review task"
- "Write tests with Playwright" → agent: codex, mcpServers: ["playwright"], reasoning: "Browser testing"
- "Debug the login flow" → agent: claude-code, mcpServers: [], reasoning: "Debugging requires code analysis"
- "Scrape this website" → agent: codex, mcpServers: ["playwright", "browserbase"], reasoning: "Web scraping with browser"
`;
```

Note: With `experimental_output`, the LLM automatically returns structured data matching the Zod schema - no need for JSON formatting instructions!

### 3. Refactor Router
**File**: `src/lib/router.ts`

```typescript
import { generateText, Output, zodSchema } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { DEUS_SYSTEM_PROMPT } from './system-prompt.js';

const routeDecisionSchema = z.object({
  agent: z.enum(['claude-code', 'codex']),
  mcpServers: z.array(z.string()),
  reasoning: z.string(),
});

type RouteDecision = z.infer<typeof routeDecisionSchema>;

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

interface RouteDecision {
  agent: 'claude-code' | 'codex';
  mcpServers: string[];
  reasoning: string;
}

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
}
```

### 4. Environment Setup

The project uses dotenv-cli to load environment variables from `.vercel/.env.development.local`:

```bash
# Install dotenv-cli
pnpm add -D dotenv-cli

# Update package.json scripts
{
  "scripts": {
    "dev": "dotenv -e .vercel/.env.development.local -- tsx src/cli.tsx",
    "with-env": "dotenv -e .vercel/.env.development.local --"
  }
}
```

Create `.vercel/.env.development.local` with your AI Gateway key:
```bash
AI_GATEWAY_API_KEY=vck_...
```

The `gateway()` function automatically uses `AI_GATEWAY_API_KEY` from environment.

## That's It!

**No other changes needed**:
- ✅ `.mcp.json` - already works
- ✅ Spawners - already work
- ✅ Session management - already works
- ✅ Orchestrator - already works
- ✅ MCP orchestrator - already works

## Test It

```bash
cd core/deus

# Ensure .vercel/.env.development.local exists with AI_GATEWAY_API_KEY
pnpm dev

# Try: "Review the authentication code"
# Expected: Routes to Claude Code via Claude Sonnet 4.5 through Vercel AI Gateway

# Try: "Write Playwright tests for the login"
# Expected: Routes to Codex with playwright MCP

# Try: "Debug the API error"
# Expected: Routes to Claude Code
```

The AI Gateway key is loaded automatically from `.vercel/.env.development.local` via dotenv-cli!

## What We're Skipping (For Now)

- ❌ .deus/config.json - hardcode everything
- ❌ DEUS.md - no project context
- ❌ Multiple routing strategies - LLM only
- ❌ Agent registry - hardcoded 2 agents
- ❌ Config validation - no config to validate
- ❌ User preferences - defaults only
- ❌ Conversation history in LLM (could add easily)

## Files to Modify

```
core/deus/
├── package.json                          # Add ai, @ai-sdk/anthropic, @ai-sdk/gateway, dotenv-cli
│                                         # Update dev script with dotenv
├── .vercel/
│   └── .env.development.local           # NEW: AI_GATEWAY_API_KEY
├── src/lib/
│   ├── system-prompt.ts                  # NEW: Hardcoded prompt
│   └── router.ts                         # REFACTOR: Use Vercel AI SDK Gateway
```

**Lines of code**: ~80 total

## Benefits of Vercel AI SDK + Gateway

1. **Simple config** - One AI_GATEWAY_API_KEY in .vercel/.env.development.local
2. **Structured output** - Type-safe Zod schemas with `experimental_output`
3. **Already in use** - Lightfast uses it (`gateway()` in examples)
4. **Simpler API** - `generateText()` vs raw Anthropic SDK
5. **Provider agnostic** - Easy to swap models later
6. **Gateway benefits** - Analytics, caching, rate limiting
7. **Latest model** - Claude Sonnet 4.5
8. **Streaming support** - Can add later if needed
9. **Type-safe** - Full TypeScript support with inference

## Next Steps (After It Works)

1. Add conversation history to LLM context
2. ~~Add structured output with Zod schemas~~ ✅ Done!
3. Add DEUS.md support (project context)
4. Add .deus/config.json (agent definitions)
5. Add error handling for gateway failures
6. Add streaming support for real-time routing decisions

## Timeline
- Install SDK: 1 min
- Write system-prompt.ts: 5 min
- Refactor router.ts: 10 min (even simpler with gateway!)
- Test: 5 min (no env setup needed!)

**Total: 20 minutes** (faster thanks to zero-config gateway!)
