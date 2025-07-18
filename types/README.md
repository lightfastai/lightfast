# Type System for AI SDK Integration

This directory contains TypeScript type definitions for integrating with the Vercel AI SDK and Mastra agents.

## Files

### `lightfast-ui-messages.ts`
Defines the main UIMessage types used throughout the chat application. Uses extracted tool schemas from V1Agent to ensure type safety.

### `agent-tool-extraction.ts`
Contains utility types for extracting tool schemas directly from Mastra agents. This ensures our UI types always match the actual agent implementation.

## Key Features

1. **Dynamic Type Extraction**: Tool schemas are extracted directly from the v1Agent instance, eliminating manual type maintenance.

2. **Type Safety**: Full TypeScript support with proper type inference - no `any` types used.

3. **Automatic Updates**: When tools are modified in the agent, the types automatically update.

## Usage

```typescript
import type { LightfastUIMessage } from './lightfast-ui-messages';
import type { V1AgentToolInput, V1AgentToolOutput } from './agent-tool-extraction';

// Use in components
const messages: LightfastUIMessage[] = [];

// Access specific tool types
type FileWriteInput = V1AgentToolInput<'fileWrite'>;
```

## How It Works

The extraction utility uses TypeScript's conditional types and type inference to extract the Zod schemas from each tool in the agent, then uses `z.infer` to get the runtime types. This approach ensures complete type safety without manual duplication.