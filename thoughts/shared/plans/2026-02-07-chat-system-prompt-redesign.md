# Chat Agent System Prompt Redesign — Implementation Plan

## Overview

Redesign the chat agent's system prompt from a monolithic `buildSystemPrompt()` with boolean flags into a composable prompt builder with typed section providers and feature flags. The system is designed so that new context sections (temporal context, user activity, workspace state, etc.) can be added over time by following a simple pattern: add a feature flag, add a data type to `PromptContext`, add a section provider. All changes stay within `apps/chat/src/ai/prompts/` — no new packages.

## Current State Analysis

### What Exists

**System Prompt Builder** (`apps/chat/src/ai/prompts/builders/system-prompt-builder.ts`):
- `buildSystemPrompt(options: SystemPromptOptions): string` — boolean-flag composition
- `SystemPromptOptions`: `{ isAnonymous, includeCitations, includeCodeFormatting?, webSearchEnabled?, basePrompt? }`
- Sections: `CORE_BEHAVIOR_SECTION` (lines 14-26), `SECURITY_GUIDELINES_SECTION` (security.ts:7-13), `CITATION_FORMAT_SECTION` (citation.ts:7-31), `ARTIFACT_INSTRUCTIONS_SECTION` (citation.ts:52-67), `CODE_FORMATTING_SECTION` (citation.ts:33-50)
- Two paths: anonymous (120-word limit, no artifacts) vs authenticated (full capabilities)
- Preset functions: `buildAnonymousSystemPrompt()`, `buildAuthenticatedSystemPrompt()`, `buildCitationTestPrompt()`, `buildGeneralTestPrompt()`

**Route Handler** (`apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts`):
- `createSystemPromptForUser(isAnonymous, webSearchEnabled)` at user-utils.ts:44-52 — wraps `buildSystemPrompt`
- Called at route.ts:479-482 after guard pipeline enriches `ChatRouteResources`
- System prompt string passed to `createAgent({ system: prompt })` at route.ts:544
- Guard pipeline enriches: `auth`, `billing`, `model`, `memory`, `request` fields

**Agent Primitive** (`core/ai-sdk/src/core/primitives/agent.ts`):
- `createAgent<TRuntimeContext, TTools>(options: AgentOptions)` stores `system: string` in `lightfastConfig`
- `buildStreamParams()` converts `system` string to `{ role: "system", content: system }` message
- No changes needed — the agent consumes a plain string

**Eval Suite** (`apps/chat/src/eval/`):
- Tests: citation-format.eval.ts, concise-format.eval.ts, security-compliance.eval.ts
- Uses preset builders: `buildCitationTestPrompt()`, `buildGeneralTestPrompt()`

### Key Discoveries
- The guard pipeline already enriches `ChatRouteResources` with all the data the prompt builder needs (auth, billing, model config, active tools)
- `createSystemPromptForUser()` at user-utils.ts:44-52 is the single callsite — clean integration point
- The console answer agent (`apps/console/src/ai/prompts/system-prompt.ts`) shows the pattern we're evolving toward: `buildAnswerSystemPrompt(workspaceContext)` with injected context
- Eval presets (`buildCitationTestPrompt`, `buildGeneralTestPrompt`) must continue working unchanged

## Desired End State

A composable prompt builder where:
1. Sections are independent, typed providers that can return content or `null`
2. Feature flags control which optional sections are active (temporal, style, tool guidance, user context, and future additions)
3. Adding a new context type follows a repeatable pattern: add flag → add data type → add section provider → register in standard providers
4. Token budgeting ensures critical sections (identity, security) are never trimmed
5. `createSystemPromptForUser()` delegates to the new builder internally — zero change for callers
6. All existing eval presets produce identical output

### Verification
- Existing eval suite passes without modification
- `buildAnonymousSystemPrompt()` / `buildAuthenticatedSystemPrompt()` produce identical output
- New builder can be used directly with feature flags for new capabilities
- TypeScript type checking passes: `pnpm --filter @app/chat typecheck`

## What We're NOT Doing

- **No new packages** — all code in `apps/chat/src/ai/prompts/`
- **No changes to `createAgent` or `Agent` class** — still consumes `system: string`
- **No changes to the guard pipeline or policy engine** — prompt builder reads enriched resources
- **No DB queries in Phase 1** — only data already available from guards
- **No model-specific prompt variants** — markdown headers work across all models (defer XML optimization)
- **No user preference storage** — style is a config default, not a persisted preference yet
- **No changes to console answer agent** — shared infrastructure is a future phase

## Implementation Approach

Build bottom-up: types → builder → section providers → feature-flagged context sections → integration. The existing `buildSystemPrompt()` becomes a thin wrapper that delegates to the new builder, ensuring backward compatibility. New context types (temporal, user activity, workspace state, etc.) are added over time by following a simple pattern: add a flag, add a data type, add a section provider.

---

## Phase 1: Core Types & Prompt Builder

### Overview
Define the type system and implement the composable prompt builder function.

### Changes Required:

#### 1. Prompt Types
**File**: `apps/chat/src/ai/prompts/types.ts` (NEW)

```typescript
import { z } from "zod";

/** Priority determines ordering and trimming behavior */
export const PromptSectionPriority = z.enum([
  "critical",  // Never trimmed (identity, security)
  "high",      // Trimmed only under extreme pressure (capabilities, tools)
  "medium",    // Trimmed when context is large (user context, temporal)
  "low",       // First to trim (style details, examples)
]);
export type PromptSectionPriority = z.infer<typeof PromptSectionPriority>;

/** A composable section of the system prompt */
export interface PromptSection {
  /** Unique section identifier */
  id: string;
  /** Section priority for token budgeting */
  priority: PromptSectionPriority;
  /** Generate the section content */
  render(): string;
  /** Estimated token count (for budgeting before rendering) */
  estimateTokens(): number;
}

/** Feature flags for optional prompt sections */
export interface PromptFeatureFlags {
  /** Enable temporal context section (default: false) */
  temporalContext?: boolean;
  /** Enable communication style section (default: true) */
  style?: boolean;
  /** Enable per-tool guidance section (default: true) */
  toolGuidance?: boolean;
  /** Enable user/workspace context section (default: false — Phase 2) */
  userContext?: boolean;
}

/** Default feature flags */
export const DEFAULT_FEATURE_FLAGS: Required<PromptFeatureFlags> = {
  temporalContext: false,
  style: true,
  toolGuidance: true,
  userContext: false,
};

/** Communication style options */
export const CommunicationStyleSchema = z.enum([
  "formal",
  "concise",
  "technical",
  "friendly",
]);
export type CommunicationStyle = z.infer<typeof CommunicationStyleSchema>;

/** Temporal context — time grounding for the model */
export interface TemporalContext {
  /** ISO 8601 timestamp */
  currentTimestamp: string;
}

/** User context — workspace info (future: preferences, activity) */
export interface UserContext {
  workspace?: {
    name: string;
    description?: string;
    repos: string[];
    integrations: string[];
  };
}

/**
 * Input context available to all section providers.
 *
 * To add a new context type, add an optional field here
 * alongside a corresponding feature flag in PromptFeatureFlags.
 */
export interface PromptContext {
  auth: {
    isAnonymous: boolean;
    userId: string;
    clerkUserId: string | null;
  };
  billing: {
    plan: string;
    limits: Record<string, unknown>;
  };
  model: {
    id: string;
    provider: string;
    maxOutputTokens: number;
  };
  activeTools: string[];
  webSearchEnabled: boolean;
  /** Feature flags — resolved with defaults before reaching sections */
  features: Required<PromptFeatureFlags>;
  /** Communication style (only used when features.style is true) */
  style: CommunicationStyle;
  /** Temporal context (only used when features.temporalContext is true) */
  temporalContext?: TemporalContext;
  /** User/workspace context (only used when features.userContext is true) */
  userContext?: UserContext;
}

/** Section provider: a function that creates PromptSections from context */
export type SectionProvider = (context: PromptContext) => PromptSection | null;
```

#### 2. Prompt Builder
**File**: `apps/chat/src/ai/prompts/builders/prompt-builder.ts` (NEW)

```typescript
import type { PromptSection, PromptContext, SectionProvider } from "../types";

/** Default token budget for system prompt */
const DEFAULT_TOKEN_BUDGET = 4000;

/** Model-specific token budgets */
const MODEL_TOKEN_BUDGETS: Record<string, number> = {
  "google/gemini-2.5-flash": 8000,
  "google/gemini-2.5-pro": 8000,
  "anthropic/claude-4-sonnet": 6000,
  "openai/gpt-5": 6000,
  "openai/gpt-5-mini": 5000,
  "openai/gpt-5-nano": 3000,
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Build a system prompt from composable section providers.
 *
 * Sections are sorted by priority (critical first), then included
 * within the token budget. Critical sections are always included.
 */
export function buildPrompt(
  context: PromptContext,
  providers: SectionProvider[],
): string {
  // 1. Generate all sections (skip nulls, catch errors)
  const sections: PromptSection[] = [];
  for (const provider of providers) {
    try {
      const section = provider(context);
      if (section) sections.push(section);
    } catch {
      // Section provider failed — skip silently
    }
  }

  // 2. Sort by priority (critical first)
  sections.sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3),
  );

  // 3. Token budgeting
  const budget =
    MODEL_TOKEN_BUDGETS[context.model.id] ?? DEFAULT_TOKEN_BUDGET;
  const included: PromptSection[] = [];
  let estimatedTokens = 0;

  for (const section of sections) {
    const sectionTokens = section.estimateTokens();
    if (
      section.priority === "critical" ||
      estimatedTokens + sectionTokens <= budget
    ) {
      included.push(section);
      estimatedTokens += sectionTokens;
    }
  }

  // 4. Render and join
  return included.map((s) => s.render()).join("\n\n");
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @app/chat typecheck`
- [x] `types.ts` exports all interfaces and the Zod schemas
- [x] `prompt-builder.ts` exports `buildPrompt`

---

## Phase 2: Section Providers

### Overview
Implement each section as an independent provider that wraps existing constants where possible. Each checks feature flags and returns `null` when disabled.

### Changes Required:

#### 1. Identity Section
**File**: `apps/chat/src/ai/prompts/sections/identity.ts` (NEW)

```typescript
import type { SectionProvider } from "../types";

export const identitySection: SectionProvider = () => ({
  id: "identity",
  priority: "critical",
  estimateTokens: () => 80,
  render: () =>
    `You are Lightfast, an AI assistant built for software teams. You help developers understand their codebase, debug issues, search documentation, and ship software faster.`,
});
```

#### 2. Core Behavior Section
**File**: `apps/chat/src/ai/prompts/sections/core-behavior.ts` (NEW)

Wraps the existing `CORE_BEHAVIOR_SECTION` constant from `system-prompt-builder.ts`.

```typescript
import type { SectionProvider } from "../types";

/** Extracted from system-prompt-builder.ts CORE_BEHAVIOR_SECTION */
const CORE_BEHAVIOR = `CORE BEHAVIOR:
- Provide direct, natural-language answers and keep the conversation flowing.
- When you use tools, summarize the outcome in plain language.
- Only refuse when a request violates policy.

FORMAT DISCIPLINE (STRICT):
- Use plain text for non-code requests.
- Include code blocks only when the user explicitly asks for code.
- Match your output format to the user's intent.

INTENT MATCHING:
- Match your output format to the user's intent.
- When uncertain about intent, ask a brief clarifying question.`;

export const coreBehaviorSection: SectionProvider = () => ({
  id: "core-behavior",
  priority: "critical",
  estimateTokens: () => 200,
  render: () => CORE_BEHAVIOR,
});
```

#### 3. Security Section
**File**: `apps/chat/src/ai/prompts/sections/security.ts` (NEW)

```typescript
import type { SectionProvider } from "../types";
import { SECURITY_GUIDELINES_SECTION } from "../security";

export const securitySection: SectionProvider = () => ({
  id: "security",
  priority: "critical",
  estimateTokens: () => 150,
  render: () => SECURITY_GUIDELINES_SECTION,
});
```

#### 4. Capabilities Section
**File**: `apps/chat/src/ai/prompts/sections/capabilities.ts` (NEW)

```typescript
import type { SectionProvider } from "../types";
import { ARTIFACT_INSTRUCTIONS_SECTION, CODE_FORMATTING_SECTION } from "../citation";

export const capabilitiesSection: SectionProvider = (ctx) => {
  if (ctx.auth.isAnonymous) {
    return {
      id: "capabilities",
      priority: "high",
      estimateTokens: () => 200,
      render: () => {
        const parts: string[] = [
          `CAPABILITIES:
- Provide information, explanations, and general assistance.
${ctx.webSearchEnabled ? "- You may use web search to verify facts or fetch recent information." : "- Do not claim you can browse the web."}`,
        ];

        parts.push(`LENGTH GUIDELINES:
- Keep replies within 120 words (~800 characters).
- Use 4-6 short sentences or up to 5 concise bullet points.
- Lead with the direct answer; avoid preambles.`);

        parts.push(CODE_FORMATTING_SECTION);

        return parts.join("\n\n");
      },
    };
  }

  return {
    id: "capabilities",
    priority: "high",
    estimateTokens: () => 200,
    render: () => {
      const parts = [ARTIFACT_INSTRUCTIONS_SECTION];
      if (ctx.webSearchEnabled) {
        parts.push(
          `WEB SEARCH: You may use web search when needed. Prefer internal knowledge first; only search for current events, pricing, or when confidence is low.`,
        );
      }
      return parts.join("\n\n");
    },
  };
};
```

#### 5. Citation Section
**File**: `apps/chat/src/ai/prompts/sections/citation.ts` (NEW)

```typescript
import type { SectionProvider } from "../types";
import { CITATION_FORMAT_SECTION } from "../citation";

export const citationSection: SectionProvider = () => ({
  id: "citation",
  priority: "high",
  estimateTokens: () => 200,
  render: () => CITATION_FORMAT_SECTION,
});
```

#### 6. Style Section
**File**: `apps/chat/src/ai/prompts/sections/style.ts` (NEW)

```typescript
import type { SectionProvider, CommunicationStyle } from "../types";

const STYLE_INSTRUCTIONS: Record<CommunicationStyle, string> = {
  formal: `COMMUNICATION STYLE:
- Write in a professional, precise tone.
- Use clear technical language without unnecessary jargon.
- Prefer concise explanations. Be thorough when the topic demands it.
- Address the user respectfully and maintain a neutral register.`,

  concise: `COMMUNICATION STYLE:
- Be as brief as possible. Omit filler words.
- Use bullet points over paragraphs.
- Lead with the answer, then provide supporting detail only if asked.
- Target responses under 100 words unless the user asks for more.`,

  technical: `COMMUNICATION STYLE:
- Prioritize accuracy and precision over readability.
- Include relevant technical details, version numbers, and specifications.
- Use code examples liberally when discussing implementation.
- Reference official documentation and standards where applicable.`,

  friendly: `COMMUNICATION STYLE:
- Be warm and conversational while staying helpful.
- Use plain language and explain technical concepts accessibly.
- Encourage follow-up questions.
- Keep a supportive, collaborative tone.`,
};

export const styleSection: SectionProvider = (ctx) => {
  if (!ctx.features.style) return null;

  return {
    id: "style",
    priority: "medium",
    estimateTokens: () => 80,
    render: () => STYLE_INSTRUCTIONS[ctx.style],
  };
};
```

#### 7. Tool Guidance Section
**File**: `apps/chat/src/ai/prompts/sections/tool-guidance.ts` (NEW)

```typescript
import type { SectionProvider } from "../types";

interface ToolGuidance {
  name: string;
  whenToUse: string;
  howToUse?: string;
}

const TOOL_GUIDANCE: Record<string, ToolGuidance> = {
  webSearch: {
    name: "webSearch",
    whenToUse:
      "Use when the user asks about current events, recent releases, pricing, documentation URLs, or when your training data may be outdated. Do not use for general knowledge questions you can answer confidently.",
    howToUse:
      "Formulate specific, focused queries. Prefer 1-2 targeted searches over broad queries. Cite results with URLs.",
  },
  createDocument: {
    name: "createDocument",
    whenToUse:
      "Use when the user explicitly requests a standalone code snippet, component, script, configuration file, or diagram. Do not use for inline code examples in conversation.",
    howToUse:
      "Choose the correct artifact kind ('code' or 'diagram'). Use a concise, descriptive title. Always summarize the artifact in chat after creation.",
  },
};

export const toolGuidanceSection: SectionProvider = (ctx) => {
  if (!ctx.features.toolGuidance) return null;

  const activeGuidance = ctx.activeTools
    .map((toolName) => TOOL_GUIDANCE[toolName])
    .filter((g): g is ToolGuidance => g !== undefined);

  if (activeGuidance.length === 0) return null;

  return {
    id: "tool-guidance",
    priority: "high",
    estimateTokens: () => activeGuidance.length * 60,
    render: () => {
      const lines = ["TOOL GUIDANCE:"];
      for (const tool of activeGuidance) {
        lines.push(`- **${tool.name}**: ${tool.whenToUse}`);
        if (tool.howToUse) {
          lines.push(`  Usage: ${tool.howToUse}`);
        }
      }
      return lines.join("\n");
    },
  };
};
```

#### 8. Standard Provider Set
**File**: `apps/chat/src/ai/prompts/builders/standard-providers.ts` (NEW)

```typescript
import { identitySection } from "../sections/identity";
import { coreBehaviorSection } from "../sections/core-behavior";
import { securitySection } from "../sections/security";
import { capabilitiesSection } from "../sections/capabilities";
import { citationSection } from "../sections/citation";
import { styleSection } from "../sections/style";
import { toolGuidanceSection } from "../sections/tool-guidance";
import { temporalContextSection } from "../sections/temporal-context";
import { userContextSection } from "../sections/user-context";
import type { SectionProvider } from "../types";

/**
 * Standard provider set for the c010 chat agent.
 *
 * Order here determines render order when priorities are equal.
 * Feature flags in PromptContext control which optional sections are active.
 */
export const STANDARD_PROVIDERS: SectionProvider[] = [
  identitySection,
  coreBehaviorSection,
  securitySection,
  capabilitiesSection,
  citationSection,
  styleSection,
  toolGuidanceSection,
  temporalContextSection,
  userContextSection,
];
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @app/chat typecheck`
- [x] All section files export a `SectionProvider`
- [x] `standard-providers.ts` exports `STANDARD_PROVIDERS`

---

## Phase 3: Feature-Flagged Context Sections

### Overview
Implement the initial feature-flagged context sections: temporal context, user context (stub). These demonstrate the pattern for adding new context types over time. Each new context type is just: a feature flag + a data type on `PromptContext` + a section provider.

### Design: How New Context Types Are Added

The extensibility lives at the **section provider + feature flag** level, not inside any individual section. Every context section follows the same three-step pattern:

```
To add a new context type (e.g., "user recent activity"):

1. Add a feature flag:     PromptFeatureFlags.recentActivity?: boolean
2. Add data to context:    PromptContext.recentActivity?: RecentActivityContext
3. Add a section provider: recentActivitySection checks flag, renders data
4. Register it:            Add to STANDARD_PROVIDERS array
```

This means temporal context, user context, recent activity, deployment status, etc. are all peers — independent sections that can be toggled on/off via their feature flag.

### Changes Required:

#### 1. Temporal Context Section
**File**: `apps/chat/src/ai/prompts/sections/temporal-context.ts` (NEW)

Temporal context is a simple, concrete section — timestamp and current-time grounding for the model.

```typescript
import type { SectionProvider } from "../types";

/**
 * Temporal context section — provides time grounding to the model.
 *
 * Returns null when features.temporalContext is false.
 */
export const temporalContextSection: SectionProvider = (ctx) => {
  if (!ctx.features.temporalContext) return null;
  if (!ctx.temporalContext) return null;

  const tc = ctx.temporalContext;

  return {
    id: "temporal-context",
    priority: "medium",
    estimateTokens: () => 30,
    render: () => {
      const parts: string[] = ["TEMPORAL CONTEXT:"];
      parts.push(`Current time: ${tc.currentTimestamp}`);
      return parts.join("\n");
    },
  };
};
```

#### 2. User Context Section (Stub)
**File**: `apps/chat/src/ai/prompts/sections/user-context.ts` (NEW)

```typescript
import type { SectionProvider } from "../types";

/**
 * User/workspace context section.
 * Returns null until features.userContext is enabled.
 */
export const userContextSection: SectionProvider = (ctx) => {
  if (!ctx.features.userContext) return null;
  if (!ctx.userContext?.workspace) return null;

  const ws = ctx.userContext.workspace;
  return {
    id: "user-context",
    priority: "medium",
    estimateTokens: () => 100,
    render: () =>
      `WORKSPACE CONTEXT:\nProject: ${ws.name}${ws.description ? `\nDescription: ${ws.description}` : ""}${ws.repos.length > 0 ? `\nRepositories: ${ws.repos.join(", ")}` : ""}${ws.integrations.length > 0 ? `\nIntegrations: ${ws.integrations.join(", ")}` : ""}`,
  };
};
```

#### 3. Update types.ts — Context Data Types

The `PromptContext` interface already has `temporalContext` and `userContext` fields from Phase 1. Here are the concrete data types (defined in `types.ts` alongside everything else):

```typescript
/** Temporal context — time grounding for the model */
export interface TemporalContext {
  /** ISO 8601 timestamp */
  currentTimestamp: string;
}

/** User context — workspace info (future: preferences, activity) */
export interface UserContext {
  workspace?: {
    name: string;
    description?: string;
    repos: string[];
    integrations: string[];
  };
}
```

These are intentionally simple. When we need more temporal data (alerts, recent activity summaries), we add **new sections** with their own flags — we don't bloat `TemporalContext`.

### How to Add a New Context Section (for future developers)

Example: adding "recent user activity" as a new context section.

**Step 1** — Add the feature flag to `PromptFeatureFlags` in `types.ts`:
```typescript
export interface PromptFeatureFlags {
  temporalContext?: boolean;
  style?: boolean;
  toolGuidance?: boolean;
  userContext?: boolean;
  recentActivity?: boolean;  // NEW
}
```

**Step 2** — Add the data type and field to `PromptContext` in `types.ts`:
```typescript
export interface RecentActivityContext {
  summary: string;
  items: Array<{ type: string; description: string; timestamp: string }>;
}

export interface PromptContext {
  // ... existing fields
  recentActivity?: RecentActivityContext;  // NEW
}
```

**Step 3** — Create the section provider in `sections/recent-activity.ts`:
```typescript
export const recentActivitySection: SectionProvider = (ctx) => {
  if (!ctx.features.recentActivity) return null;
  if (!ctx.recentActivity) return null;

  return {
    id: "recent-activity",
    priority: "medium",
    estimateTokens: () => 50 + ctx.recentActivity.items.length * 20,
    render: () => {
      const lines = [`RECENT ACTIVITY:\n${ctx.recentActivity.summary}`];
      for (const item of ctx.recentActivity.items) {
        lines.push(`- [${item.type}] ${item.description}`);
      }
      return lines.join("\n");
    },
  };
};
```

**Step 4** — Register it in `standard-providers.ts`:
```typescript
export const STANDARD_PROVIDERS: SectionProvider[] = [
  // ... existing providers
  recentActivitySection,
];
```

**Step 5** — Pass data from the route handler:
```typescript
createSystemPromptForUser(isAnonymous, webSearchEnabled, {
  features: { recentActivity: true },
  recentActivity: { summary: "...", items: [...] },
});
```

That's it. No builder patterns, no registries. Each context type is a self-contained section.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @app/chat typecheck`
- [x] `temporal-context.ts` section returns `null` when `features.temporalContext` is false
- [x] `user-context.ts` section returns `null` when `features.userContext` is false

---

## Phase 4: Integration & Backward Compatibility

### Overview
Wire the new prompt builder into the route handler via a backward-compatible wrapper. The existing `buildSystemPrompt()` and preset functions continue to work unchanged.

### Changes Required:

#### 1. Prompt Context Builder
**File**: `apps/chat/src/ai/prompts/context.ts` (NEW)

```typescript
import type {
  PromptContext,
  PromptFeatureFlags,
  CommunicationStyle,
  TemporalContext,
  UserContext,
} from "./types";
import { DEFAULT_FEATURE_FLAGS } from "./types";

/**
 * Build PromptContext from route handler data.
 *
 * This is the bridge between the guard-enriched resources
 * and the composable prompt builder.
 */
export function buildPromptContext(options: {
  isAnonymous: boolean;
  userId: string;
  clerkUserId?: string | null;
  plan?: string;
  modelId?: string;
  modelProvider?: string;
  modelMaxOutputTokens?: number;
  activeTools?: string[];
  webSearchEnabled?: boolean;
  features?: PromptFeatureFlags;
  style?: CommunicationStyle;
  temporalContext?: TemporalContext;
  userContext?: UserContext;
}): PromptContext {
  const features: Required<PromptFeatureFlags> = {
    ...DEFAULT_FEATURE_FLAGS,
    ...options.features,
  };

  return {
    auth: {
      isAnonymous: options.isAnonymous,
      userId: options.userId,
      clerkUserId: options.clerkUserId ?? null,
    },
    billing: {
      plan: options.plan ?? "free",
      limits: {},
    },
    model: {
      id: options.modelId ?? "google/gemini-2.5-flash",
      provider: options.modelProvider ?? "gateway",
      maxOutputTokens: options.modelMaxOutputTokens ?? 100000,
    },
    activeTools: options.activeTools ?? [],
    webSearchEnabled: options.webSearchEnabled ?? false,
    features,
    style: options.style ?? "formal",
    temporalContext: options.temporalContext,
    userContext: options.userContext,
  };
}
```

#### 2. Update `system-prompt-builder.ts` — Backward-Compatible Wrapper
**File**: `apps/chat/src/ai/prompts/builders/system-prompt-builder.ts` (MODIFY)

Add a new function that delegates to the composable builder. Keep ALL existing exports unchanged.

```typescript
// ADD at the end of the file — keep all existing code intact

import { buildPrompt } from "./prompt-builder";
import { STANDARD_PROVIDERS } from "./standard-providers";
import { buildPromptContext } from "../context";
import type { PromptFeatureFlags, CommunicationStyle, TemporalContext, UserContext } from "../types";

/**
 * Build system prompt using the composable prompt builder.
 *
 * This is the new entry point. The legacy `buildSystemPrompt()` above
 * remains for backward compatibility with eval presets.
 *
 * @param options - Route handler data + optional feature flags
 * @returns Complete system prompt string
 */
export function buildComposableSystemPrompt(options: {
  isAnonymous: boolean;
  userId: string;
  clerkUserId?: string | null;
  plan?: string;
  modelId?: string;
  activeTools?: string[];
  webSearchEnabled?: boolean;
  features?: PromptFeatureFlags;
  style?: CommunicationStyle;
  temporalContext?: TemporalContext;
  userContext?: UserContext;
}): string {
  const context = buildPromptContext(options);
  return buildPrompt(context, STANDARD_PROVIDERS);
}
```

#### 3. Update `createSystemPromptForUser`
**File**: `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/_lib/user-utils.ts` (MODIFY)

Replace the `createSystemPromptForUser` implementation to use the new builder. The function signature and behavior remain identical for callers that don't pass extra options.

```typescript
// Replace the existing createSystemPromptForUser implementation:

import { buildComposableSystemPrompt } from "../../../../../../ai/prompts/builders/system-prompt-builder";
import type { PromptFeatureFlags, CommunicationStyle, TemporalContext, UserContext } from "../../../../../../ai/prompts/types";

export const createSystemPromptForUser = (
  isAnonymous: boolean,
  webSearchEnabled: boolean,
  options?: {
    userId?: string;
    clerkUserId?: string | null;
    plan?: string;
    modelId?: string;
    activeTools?: string[];
    features?: PromptFeatureFlags;
    style?: CommunicationStyle;
    temporalContext?: TemporalContext;
    userContext?: UserContext;
  },
): string => {
  return buildComposableSystemPrompt({
    isAnonymous,
    webSearchEnabled,
    userId: options?.userId ?? "anonymous",
    clerkUserId: options?.clerkUserId,
    plan: options?.plan,
    modelId: options?.modelId,
    activeTools: options?.activeTools,
    features: options?.features,
    style: options?.style,
    temporalContext: options?.temporalContext,
    userContext: options?.userContext,
  });
};
```

**Important**: The existing callsite in `route.ts:479-482` calls `createSystemPromptForUser(isAnonymous, webSearchEnabled)` with just two args — this continues to work because `options` is optional and defaults are applied.

#### 4. Barrel Export
**File**: `apps/chat/src/ai/prompts/index.ts` (NEW)

```typescript
// Core types
export type {
  PromptSection,
  PromptContext,
  PromptFeatureFlags,
  CommunicationStyle,
  SectionProvider,
  TemporalContext,
  UserContext,
} from "./types";
export {
  PromptSectionPriority,
  CommunicationStyleSchema,
  DEFAULT_FEATURE_FLAGS,
} from "./types";

// Builders
export { buildPrompt } from "./builders/prompt-builder";
export { buildComposableSystemPrompt } from "./builders/system-prompt-builder";
export { STANDARD_PROVIDERS } from "./builders/standard-providers";

// Context
export { buildPromptContext } from "./context";

// Legacy — keep existing exports
export { buildSystemPrompt, buildAnonymousSystemPrompt, buildAuthenticatedSystemPrompt, buildCitationTestPrompt, buildGeneralTestPrompt } from "./builders/system-prompt-builder";
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @app/chat typecheck`
- [x] Linting passes: `pnpm --filter @app/chat lint`
- [ ] Existing eval presets (`buildCitationTestPrompt`, `buildGeneralTestPrompt`) still work — run eval suite if available
- [ ] `createSystemPromptForUser(true, false)` produces a valid prompt (no runtime errors)
- [ ] `createSystemPromptForUser(false, true)` produces a valid prompt (no runtime errors)

#### Manual Verification:
- [ ] Start dev server (`pnpm dev:app`), open chat, send a message — verify response is normal
- [ ] Anonymous chat session works correctly (length constraints, no artifacts)
- [ ] Authenticated chat session works correctly (artifacts, citations)
- [ ] No regressions in response quality

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the chat experience is unchanged.

---

## Testing Strategy

### Unit Tests

The composable builder is a pure function — easy to unit test:

1. **`buildPrompt` tests**:
   - Given critical + medium sections and a small budget, verify critical sections are never trimmed
   - Given all sections, verify output order matches priority
   - Given a section provider that throws, verify it's skipped

2. **Section provider tests**:
   - `identitySection` always returns content
   - `securitySection` always returns content
   - `styleSection` returns null when `features.style` is false
   - `toolGuidanceSection` returns null when `features.toolGuidance` is false
   - `temporalContextSection` returns null when `features.temporalContext` is false
   - `userContextSection` returns null when `features.userContext` is false

3. **Feature flag tests**:
   - Context with all flags false produces only critical sections
   - Context with all flags true includes all sections
   - Each flag independently controls its section

### Integration Tests

4. **Backward compatibility**:
   - `buildAnonymousSystemPrompt()` output matches the legacy output character-for-character (snapshot test)
   - `buildAuthenticatedSystemPrompt()` output matches legacy
   - `buildCitationTestPrompt()` output matches legacy
   - `buildGeneralTestPrompt()` output matches legacy

### Manual Testing Steps
1. Open chat as anonymous user — verify length constraints and no artifacts
2. Open chat as authenticated user — verify full capabilities
3. Enable web search — verify web search guidance appears in responses
4. Verify citation formatting is correct in responses

---

## Performance Considerations

- **No additional latency**: The prompt builder is synchronous string concatenation — sub-millisecond
- **Future async context sections**: When context sections need async data (e.g., workspace activity from DB), the data should be fetched in the route handler (parallel with guards) and passed into `PromptContext`. The prompt builder itself stays synchronous.
- **Token estimation**: Character-based estimates (~4 chars/token) — no tokenizer dependency. Sufficient for budgeting since critical sections are never trimmed regardless

## File Summary

### New Files (13)
| File | Description |
|------|-------------|
| `apps/chat/src/ai/prompts/types.ts` | Core types: PromptSection, PromptContext, PromptFeatureFlags, TemporalContext, UserContext |
| `apps/chat/src/ai/prompts/context.ts` | PromptContext builder from route handler data |
| `apps/chat/src/ai/prompts/index.ts` | Barrel export |
| `apps/chat/src/ai/prompts/builders/prompt-builder.ts` | Composable prompt builder function |
| `apps/chat/src/ai/prompts/builders/standard-providers.ts` | Default section provider set |
| `apps/chat/src/ai/prompts/sections/identity.ts` | Identity section provider |
| `apps/chat/src/ai/prompts/sections/core-behavior.ts` | Core behavior section provider |
| `apps/chat/src/ai/prompts/sections/security.ts` | Security section provider |
| `apps/chat/src/ai/prompts/sections/capabilities.ts` | Capabilities section provider |
| `apps/chat/src/ai/prompts/sections/citation.ts` | Citation section provider |
| `apps/chat/src/ai/prompts/sections/style.ts` | Style section provider |
| `apps/chat/src/ai/prompts/sections/tool-guidance.ts` | Tool guidance section provider |
| `apps/chat/src/ai/prompts/sections/temporal-context.ts` | Temporal context section provider |
| `apps/chat/src/ai/prompts/sections/user-context.ts` | User context section provider (stub) |

### Modified Files (2)
| File | Change |
|------|--------|
| `apps/chat/src/ai/prompts/builders/system-prompt-builder.ts` | Add `buildComposableSystemPrompt()` export |
| `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/_lib/user-utils.ts` | Update `createSystemPromptForUser()` to use new builder |

## References

- Architecture design: `thoughts/shared/research/2026-02-07-chat-system-prompt-architecture-design.md`
- Existing builder: `apps/chat/src/ai/prompts/builders/system-prompt-builder.ts`
- Route handler: `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts`
- Console answer pattern: `apps/console/src/ai/prompts/system-prompt.ts`
- Policy engine: `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/_lib/policy-engine.ts`
- Agent primitive: `core/ai-sdk/src/core/primitives/agent.ts`
