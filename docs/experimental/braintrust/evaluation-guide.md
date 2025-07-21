# Braintrust Evaluation Guide for Mastra Agents

This guide provides a comprehensive overview of how to set up and run evaluations for Mastra agents using Braintrust.

## Overview

Braintrust is an evaluation framework that helps measure agent performance, track improvements, and ensure quality. Your project has Braintrust integrated with:

- Local development support (no API key required)
- Production logging with Braintrust cloud
- Comprehensive scoring metrics
- Tool execution tracking

## Key Components

### 1. Braintrust Utilities (`mastra/lib/braintrust-utils.ts`)

The utilities provide:
- **Local Development Mode**: Logs to console when no API key is present
- **Agent Evaluation Scores**: Relevancy, completeness, accuracy, helpfulness, toxicity, bias, safety
- **Tool Execution Tracking**: Success rates, performance metrics
- **Conversation-Level Evaluation**: End-to-end conversation quality

### 2. Evaluation Scripts (`scripts/`)

- `experimental-agents.eval.ts`: Evaluates a010 and a011 agents
- `braintrust-local.eval.ts`: Demonstrates local evaluation
- `experimental-agents-fixed.eval.ts`: Alternative evaluation scenarios

## Setting Up Evaluations

### 1. Environment Configuration

```bash
# For production (optional)
BRAINTRUST_API_KEY=your-api-key
BRAINTRUST_PROJECT_ID=lightfast-experimental-agents

# For local development (no API key needed)
NODE_ENV=development
```

### 2. Installing Dependencies

```bash
pnpm install braintrust @mastra/evals
```

### 3. Running Evaluations

```bash
# Local mode (no Braintrust cloud)
npx braintrust eval --no-send-logs scripts/experimental-agents.eval.ts

# Development mode with UI
npx braintrust eval --dev --dev-port 8300 scripts/experimental-agents.eval.ts

# Production mode (requires API key)
npx braintrust eval scripts/experimental-agents.eval.ts
```

## Creating Agent Evaluations

### Basic Evaluation Structure

```typescript
import { Eval } from "braintrust";
import { mastra } from "../mastra";

Eval("agent-evaluation-name", {
  data: () => [
    // Test scenarios
    {
      input: { query: "Test prompt", agent: "agentName" },
      expected: { /* expected outcomes */ }
    }
  ],
  
  task: async (scenario) => {
    // Execute agent with scenario
    const agent = mastra.getAgent(scenario.input.agent);
    const result = await agent.generate(scenario.input.query);
    return result.text;
  },
  
  scores: [
    (scenario, output) => ({
      accuracy: evaluateAccuracy(output),
      completeness: evaluateCompleteness(output),
      tool_usage: evaluateToolUsage(output)
    })
  ]
});
```

### Agent-Specific Evaluation Patterns

#### For a010 Agent (Experimental)
```typescript
const a010Scenarios = [
  {
    input: {
      agent: "a010",
      query: "Research AI frameworks and create a comparison report",
      expectedTools: ["webSearch", "fileWrite"]
    },
    expected: {
      hasResearch: true,
      hasReport: true,
      fileCreated: true
    }
  }
];
```

#### For Standalone Agents
```typescript
const mathAgentScenarios = [
  {
    input: {
      agent: "mathAgent",
      query: "Calculate the factorial of 10"
    },
    expected: {
      result: 3628800,
      toolUsed: "factorial"
    }
  }
];
```

## Evaluation Metrics

### Core Metrics

1. **Relevancy** (0-1): How relevant is the response to the query
2. **Completeness** (0-1): Did the agent complete the requested task
3. **Accuracy** (0-1): Correctness of the information provided
4. **Helpfulness** (0-1): How helpful is the response to the user

### Safety Metrics

1. **Toxicity** (0-1): Presence of harmful content
2. **Bias** (0-1): Presence of biased statements
3. **Safety** (0-1): Overall safety of the response

### Performance Metrics

1. **Tool Success Rate** (0-1): Percentage of successful tool executions
2. **Response Time** (ms): Time taken to generate response
3. **Task Completion** (0-1): Whether the task was completed

## Local Development Mode

When `BRAINTRUST_API_KEY` is not set, the system automatically falls back to local logging:

```typescript
// In your evaluation script
import { logAgentInteraction } from "../mastra/lib/braintrust-utils";

// This will log to console in development
await logAgentInteraction(
  {
    messages: [{ role: "user", content: "Test query" }],
    agentName: "a010",
    threadId: "test-thread"
  },
  {
    response: "Agent response",
    tool_calls: [{ name: "webSearch", result: {}, success: true }]
  },
  {
    relevancy: 0.9,
    completeness: 1.0,
    accuracy: 0.95
  }
);
```

Console output in local mode:
```
[BRAINTRUST LOCAL] {
  "input": { ... },
  "output": { ... },
  "scores": { ... },
  "metadata": { ... }
}
```

## Real-World Evaluation Examples

### 1. Research Task Evaluation

```typescript
{
  input: {
    agent: "a010",
    query: "Research the latest developments in AI safety and create a summary"
  },
  scoring: {
    // Check if research was conducted
    research_quality: output.includes("sources") ? 1 : 0,
    // Check if summary was created
    summary_created: output.includes("summary") ? 1 : 0,
    // Check tool usage
    tools_used: countToolMentions(output) >= 2 ? 1 : 0.5
  }
}
```

### 2. Task Decomposition Evaluation (a011)

```typescript
{
  input: {
    agent: "a011",
    query: "Plan and execute a code refactoring project"
  },
  scoring: {
    // Check task breakdown
    task_decomposition: countTasks(output) >= 3 ? 1 : 0,
    // Check systematic approach
    workflow_quality: hasWorkflowPattern(output) ? 1 : 0.5,
    // Check completion tracking
    progress_tracking: hasProgressIndicators(output) ? 1 : 0.7
  }
}
```

### 3. Math Agent Evaluation

```typescript
{
  input: {
    agent: "mathAgent",
    query: "Solve x^2 + 5x + 6 = 0"
  },
  expected: {
    roots: [-2, -3],
    method: "quadratic"
  },
  scoring: {
    correctness: compareRoots(output, expected.roots),
    method_used: output.includes("quadratic") ? 1 : 0
  }
}
```

## Best Practices

### 1. Comprehensive Test Coverage

```typescript
const testCategories = [
  "simple_queries",      // Basic functionality
  "complex_workflows",   // Multi-step tasks
  "error_handling",      // Edge cases
  "tool_integration",    // Tool usage
  "safety_checks"        // Content safety
];
```

### 2. Realistic Scenarios

```typescript
// Good: Realistic user query
{ query: "Help me analyze sales data and create visualizations" }

// Bad: Too abstract
{ query: "Do something with data" }
```

### 3. Progressive Complexity

```typescript
const scenarios = [
  { complexity: "low", query: "What is 2 + 2?" },
  { complexity: "medium", query: "Calculate compound interest over 5 years" },
  { complexity: "high", query: "Optimize portfolio allocation using modern portfolio theory" }
];
```

### 4. Tool Usage Validation

```typescript
function validateToolUsage(output: string, expectedTools: string[]): number {
  const toolsUsed = extractToolsFromOutput(output);
  const correctTools = expectedTools.filter(tool => toolsUsed.includes(tool));
  return correctTools.length / expectedTools.length;
}
```

## Running Evaluations in CI/CD

```yaml
# .github/workflows/evaluate.yml
name: Agent Evaluation
on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: npx braintrust eval --no-send-logs scripts/experimental-agents.eval.ts
      - run: npx braintrust eval --no-send-logs scripts/standalone-agents.eval.ts
```

## Analyzing Results

### Local Development
- Check console output for scores
- Look for patterns in failures
- Identify tools that aren't being used correctly

### Production (with Braintrust Cloud)
- View results at https://app.braintrust.dev
- Compare experiments over time
- Track regression in scores
- Analyze tool usage patterns

## Troubleshooting

### Common Issues

1. **"BRAINTRUST_API_KEY not found"**
   - This is fine for local development
   - The system will automatically use local logging

2. **Agent not found**
   - Ensure agent is registered in `mastra/index.ts`
   - Check agent name matches exactly

3. **Tool execution failures**
   - Verify tools are properly registered with agent
   - Check tool permissions and dependencies

4. **Scoring inconsistencies**
   - Review scoring functions for edge cases
   - Ensure expected outputs are realistic

## Next Steps

1. Create agent-specific evaluation scripts
2. Set up continuous evaluation in CI/CD
3. Track performance improvements over time
4. Use results to guide agent development
5. Share evaluation reports with team

## Resources

- [Braintrust Documentation](https://docs.braintrust.com)
- [Mastra Evaluation Framework](https://mastra.ai/docs/evals)
- Project evaluation scripts: `scripts/*.eval.ts`
- Braintrust utilities: `mastra/lib/braintrust-utils.ts`