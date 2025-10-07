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

### 1. Install Vercel AI SDK
```bash
cd core/deus
pnpm add ai @ai-sdk/anthropic
```

### 2. Create System Prompt (Hardcoded)
**File**: `src/lib/system-prompt.ts`

```typescript
export const DEUS_SYSTEM_PROMPT = `You are Deus, an AI orchestrator that routes tasks to specialized agents.

Available agents:
- claude-code: Code review, debugging, refactoring, documentation, git operations
- codex: Testing, web automation, Playwright, browser tasks, E2E testing

Analyze the user's request and respond with ONLY a JSON object:
{
  "agent": "claude-code" | "codex",
  "mcpServers": string[],
  "reasoning": string
}

Available MCP servers:
- playwright: Browser automation
- browserbase: Cloud browser sessions
- deus-session: Session management (always included)

Examples:
- "Review the auth code" → {"agent": "claude-code", "mcpServers": [], "reasoning": "Code review task"}
- "Write tests with Playwright" → {"agent": "codex", "mcpServers": ["playwright"], "reasoning": "Browser testing"}
- "Debug the login flow" → {"agent": "claude-code", "mcpServers": [], "reasoning": "Debugging requires code analysis"}
- "Scrape this website" → {"agent": "codex", "mcpServers": ["playwright", "browserbase"], "reasoning": "Web scraping with browser"}
`;
```

### 3. Refactor Router
**File**: `src/lib/router.ts`

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
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
      const { text } = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: DEUS_SYSTEM_PROMPT,
        prompt: message,
        temperature: 0.2,
      });

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[Deus Router] No JSON in response:', text);
        return null;
      }

      const decision = JSON.parse(jsonMatch[0]) as RouteDecision;

      // Validate decision
      if (!decision.agent || !['claude-code', 'codex'].includes(decision.agent)) {
        console.error('[Deus Router] Invalid agent:', decision.agent);
        return null;
      }

      return decision;
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

### 4. Environment Variable
Add to `.env` in `core/deus/`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Or export globally:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

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
export ANTHROPIC_API_KEY=sk-ant-...
pnpm dev

# Try: "Review the authentication code"
# Expected: Routes to Claude Code

# Try: "Write Playwright tests for the login"
# Expected: Routes to Codex with playwright MCP

# Try: "Debug the API error"
# Expected: Routes to Claude Code
```

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
├── package.json                          # Add ai, @ai-sdk/anthropic
├── src/lib/
│   ├── system-prompt.ts                  # NEW: Hardcoded prompt
│   └── router.ts                         # REFACTOR: Use Vercel AI SDK
```

**Lines of code**: ~80 total

## Benefits of Vercel AI SDK

1. **Already in use** - Lightfast uses it (`gateway()` in examples)
2. **Simpler API** - `generateText()` vs raw Anthropic SDK
3. **Provider agnostic** - Easy to swap models later
4. **Streaming support** - Can add later if needed
5. **Type-safe** - Full TypeScript support

## Next Steps (After It Works)

1. Add conversation history to LLM context
2. Add structured output with Zod schemas
3. Add DEUS.md support (project context)
4. Add .deus/config.json (agent definitions)
5. Add pattern matching fallback (if API key missing)

## Timeline
- Install SDK: 1 min
- Write system-prompt.ts: 5 min
- Refactor router.ts: 15 min
- Test: 10 min

**Total: 30 minutes**
