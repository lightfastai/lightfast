# V2 Agent - AI SDK streamText Integration Plan

## Current State Analysis

### V1 Agent (primitives/agent.ts)
- Extends streamText parameters directly via `AgentConfig`
- Separates agent-specific properties from streamText properties
- Uses type-safe parameter passing from streamText
- Supports all streamText options (model, temperature, maxSteps, etc.)
- Clean separation of concerns with excluded properties

### V2 Agent (v2/agent.ts)
- Custom `AgentOptions` interface with limited properties
- Hardcoded streamText configuration in `makeDecision()`
- No direct compatibility with streamText parameters
- Limited configuration options

## Minimal Integration Plan (Phase 1)

### 1. Update AgentOptions Interface
```typescript
// Extract core types from streamText
type StreamTextParameters<TOOLS extends ToolSet> = Parameters<typeof streamText<TOOLS>>[0];

// Properties to exclude from streamText
type ExcludedStreamTextProps =
  | "messages"    // Handled by session
  | "tools"       // Handled by agent
  | "system"      // Part of agent config
  | "prompt";     // We use messages

// New AgentConfig extending streamText parameters
export interface AgentConfig extends Omit<StreamTextParameters<ToolSet>, ExcludedStreamTextProps> {
  name: string;
}

// Updated AgentOptions
export interface AgentOptions extends AgentConfig {
  systemPrompt: string;
  tools: AgentToolDefinition[];  // Keep existing tool structure for now
}
```

### 2. Update Agent Constructor
```typescript
export class Agent {
  public readonly config: AgentConfig;
  private systemPrompt: string;
  private tools: Map<string, AgentToolDefinition>;

  constructor(options: AgentOptions, redis: Redis, eventEmitter: EventEmitter) {
    const { systemPrompt, tools, ...config } = options;
    
    this.systemPrompt = systemPrompt;
    this.tools = new Map(tools.map(tool => [tool.name, tool]));
    this.config = config;  // All streamText-compatible properties
    
    // Rest of constructor...
  }
}
```

### 3. Update makeDecision Method
```typescript
private async makeDecision(session: AgentSessionState, sessionEmitter: SessionEventEmitter): Promise<AgentDecision> {
  const systemPrompt = this.buildSystemPrompt(session);
  const messages = this.prepareMessages(session.messages);

  // Use config properties directly from this.config
  const { textStream } = await streamText({
    ...this.config,  // Spread all streamText-compatible properties
    system: systemPrompt,
    messages,
    // Override with session-specific values if needed
    temperature: session.temperature ?? this.config.temperature,
    onFinish: async (result) => {
      // Existing onFinish logic...
    },
  });

  // Rest of method...
}
```

### 4. Benefits of This Approach
- Direct compatibility with streamText parameters
- Type safety for all AI SDK options
- Minimal breaking changes
- Easy to extend with additional streamText features
- Maintains existing tool structure (for Phase 1)

## Implementation Steps

1. **Update type imports**
   - Import streamText parameter types
   - Import necessary AI SDK types

2. **Refactor AgentOptions interface**
   - Extend from streamText parameters
   - Keep existing properties as additions

3. **Update Agent class**
   - Store config separately
   - Pass config to streamText calls

4. **Test compatibility**
   - Ensure existing functionality works
   - Test new streamText parameters

## Future Phases (Not in Current Scope)

### Phase 2: Tool System Alignment
- Migrate to AI SDK's Tool type system
- Support tool factories pattern
- Type-safe tool resolution

### Phase 3: Advanced Features
- Provider-specific caching
- Custom transforms
- Advanced callbacks (onChunk, onStepFinish, etc.)

## Example Usage After Integration

```typescript
const agent = new Agent({
  name: "v2-test",
  systemPrompt: "You are a helpful assistant",
  tools: [calculatorTool, weatherTool],
  
  // All streamText parameters now available
  model: wrapLanguageModel({
    model: gateway("anthropic/claude-4-sonnet"),
    middleware: BraintrustMiddleware({ debug: true }),
  }),
  temperature: 0.7,
  maxSteps: 10,
  providerOptions: {
    anthropic: {
      thinking: { type: "enabled", budgetTokens: 32000 }
    }
  },
  headers: {
    "anthropic-beta": "interleaved-thinking-2025-05-14"
  },
  experimental_transform: smoothStream({
    delayInMs: 25,
    chunking: "word"
  }),
}, redis, eventEmitter);
```

This plan provides a clear path to make the v2 agent compatible with streamText while maintaining backward compatibility and setting up for future enhancements.