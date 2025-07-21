# Evaluation Best Practices for Mastra Agents

This document outlines best practices for creating effective evaluations for Mastra agents using Braintrust.

## Core Principles

### 1. Test What Matters
Focus on evaluating the specific capabilities and intended use cases of each agent:
- **Math agents**: Accuracy of calculations
- **Browser agents**: Successful navigation and interaction
- **Research agents**: Quality and relevance of information gathered
- **Task-oriented agents**: Completion of specified tasks

### 2. Use Realistic Scenarios
```typescript
// Good: Realistic user query
{
  query: "Find the latest TypeScript features and create a summary",
  expectedBehavior: "research + synthesis"
}

// Bad: Too vague
{
  query: "Do something with TypeScript",
  expectedBehavior: "unclear"
}
```

### 3. Progressive Difficulty
Structure your test scenarios from simple to complex:
```typescript
const scenarios = [
  // Level 1: Basic functionality
  { query: "Calculate 2 + 2", difficulty: "basic" },
  
  // Level 2: Standard use case
  { query: "Solve x^2 + 5x + 6 = 0", difficulty: "intermediate" },
  
  // Level 3: Complex scenarios
  { query: "Analyze this dataset and create visualizations", difficulty: "advanced" }
];
```

## Scoring Guidelines

### 1. Multi-Dimensional Scoring
Don't rely on a single metric. Use multiple dimensions:

```typescript
const scores = {
  // Task completion
  task_completion: didCompleteTask ? 1 : 0,
  
  // Quality metrics
  accuracy: measureAccuracy(output, expected),
  relevancy: measureRelevancy(query, output),
  
  // Performance
  response_time: normalizeTime(duration),
  
  // Safety
  safety: checkSafety(output),
  toxicity: detectToxicity(output)
};
```

### 2. Context-Aware Scoring
Adjust scoring based on agent type and task:

```typescript
function scoreByAgentType(agent: string, output: string): number {
  switch(agent) {
    case "mathAgent":
      // Precision is critical
      return output === expectedValue ? 1 : 0;
      
    case "creativeAgent":
      // Allow for variation
      return evaluateCreativity(output);
      
    case "researchAgent":
      // Check comprehensiveness
      return evaluateCoverage(output);
  }
}
```

### 3. Tool Usage Evaluation
Track and score tool utilization:

```typescript
const toolScore = {
  // Did they use the right tools?
  tool_selection: usedExpectedTools ? 1 : 0,
  
  // Did tools succeed?
  tool_success_rate: successfulTools / totalTools,
  
  // Was tool usage efficient?
  tool_efficiency: minRequiredTools / actualToolsUsed
};
```

## Test Data Management

### 1. Version Your Test Data
```typescript
const testSuite = {
  version: "1.0.0",
  lastUpdated: "2024-01-15",
  scenarios: [...],
  changelog: [
    "1.0.0: Initial test suite",
    "0.9.0: Added edge cases"
  ]
};
```

### 2. Use Fixtures for Consistency
```typescript
// fixtures/math-problems.ts
export const quadraticProblems = [
  { equation: "x^2 + 5x + 6 = 0", roots: [-2, -3] },
  { equation: "2x^2 - 4x - 6 = 0", roots: [3, -1] }
];

// In your eval
import { quadraticProblems } from "./fixtures/math-problems";
```

### 3. Handle Dynamic Content
For tests involving web content or time-sensitive data:
```typescript
const scenario = {
  query: "What's the current Bitcoin price?",
  validation: (output: string) => {
    // Check format, not exact value
    return /\$[\d,]+\.?\d*/.test(output);
  }
};
```

## Error Handling and Edge Cases

### 1. Test Failure Modes
```typescript
const edgeCases = [
  // Invalid input
  { query: "Calculate the square root of -1", expectedBehavior: "handle_gracefully" },
  
  // Resource unavailable
  { query: "Read non-existent file", expectedBehavior: "error_message" },
  
  // Timeout scenarios
  { query: "Process 1TB of data", expectedBehavior: "timeout_handling" }
];
```

### 2. Graceful Degradation
```typescript
async function evaluateWithFallback(agent: Agent, scenario: Scenario) {
  try {
    return await agent.generate(scenario.query);
  } catch (error) {
    // Still score the error handling
    return {
      output: error.message,
      scores: {
        error_handling: isGracefulError(error) ? 1 : 0,
        task_completion: 0
      }
    };
  }
}
```

## Performance Considerations

### 1. Batch Evaluations
```typescript
// Run scenarios in parallel when possible
const results = await Promise.all(
  scenarios.map(scenario => evaluateAgent(scenario))
);
```

### 2. Use Timeouts
```typescript
const evaluateWithTimeout = async (agent, query, timeout = 30000) => {
  return Promise.race([
    agent.generate(query),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout")), timeout)
    )
  ]);
};
```

### 3. Cache Expensive Operations
```typescript
const cachedWebSearch = memoize(
  async (query: string) => webSearch(query),
  { ttl: 3600000 } // 1 hour cache
);
```

## Local Development Workflow

### 1. Start with Local Evaluation
```bash
# No API key needed
NODE_ENV=development pnpm tsx scripts/local-eval-example.ts
```

### 2. Iterate Quickly
```typescript
// Use focused test sets during development
const devScenarios = scenarios.filter(s => s.tags?.includes("quick"));
```

### 3. Visual Feedback
```typescript
function displayResults(scores: Scores) {
  console.log("\n📊 Evaluation Results:");
  Object.entries(scores).forEach(([metric, score]) => {
    const bar = "█".repeat(Math.floor(score * 20));
    console.log(`${metric}: ${bar} ${(score * 100).toFixed(0)}%`);
  });
}
```

## CI/CD Integration

### 1. Automated Evaluation
```yaml
# .github/workflows/evaluate.yml
- name: Run Evaluations
  run: |
    npx braintrust eval --no-send-logs scripts/a010-agent.eval.ts
    npx braintrust eval --no-send-logs scripts/standalone-agents.eval.ts
  env:
    NODE_ENV: test
```

### 2. Performance Regression Detection
```typescript
const performanceThresholds = {
  response_time: 0.8,  // Must maintain 80% performance score
  accuracy: 0.9,       // Must maintain 90% accuracy
  task_completion: 0.85 // Must complete 85% of tasks
};

function checkRegressions(currentScores: Scores, thresholds: Scores): boolean {
  return Object.entries(thresholds).every(
    ([metric, threshold]) => currentScores[metric] >= threshold
  );
}
```

### 3. Evaluation Reports
```typescript
function generateReport(results: EvalResults[]) {
  const report = {
    summary: {
      totalTests: results.length,
      passed: results.filter(r => r.passed).length,
      avgScores: calculateAverages(results)
    },
    details: results,
    recommendations: generateRecommendations(results)
  };
  
  fs.writeFileSync("eval-report.json", JSON.stringify(report, null, 2));
}
```

## Common Pitfalls to Avoid

### 1. Over-Specific Assertions
```typescript
// Bad: Too specific
expect(output).toBe("The capital of France is Paris.");

// Good: Flexible matching
expect(output.toLowerCase()).toContain("paris");
expect(output.toLowerCase()).toContain("france");
```

### 2. Ignoring Context
```typescript
// Bad: Same scoring for all agents
const score = output.length > 100 ? 1 : 0;

// Good: Context-aware scoring
const score = agent.type === "verbose" 
  ? output.length > 200 ? 1 : 0.5
  : output.length > 50 ? 1 : 0.5;
```

### 3. Not Testing Real Usage
```typescript
// Bad: Synthetic test
{ query: "TEST_MATH_FUNCTION_1" }

// Good: Real-world scenario
{ query: "Calculate my monthly mortgage payment for a $300k loan at 5% interest" }
```

## Debugging Failed Evaluations

### 1. Verbose Logging
```typescript
if (process.env.DEBUG) {
  console.log("Query:", scenario.query);
  console.log("Expected:", scenario.expected);
  console.log("Actual:", output);
  console.log("Scores:", scores);
}
```

### 2. Intermediate State Inspection
```typescript
const debugEval = async (agent, query) => {
  console.log("🔍 Starting evaluation...");
  
  const result = await agent.generate(query, {
    onToolCall: (tool, args) => console.log(`🔧 Tool: ${tool}`, args),
    onStep: (step) => console.log(`📍 Step: ${step}`)
  });
  
  return result;
};
```

### 3. Comparison Mode
```typescript
async function compareAgents(query: string, agents: string[]) {
  console.log(`\nComparing agents for: "${query}"\n`);
  
  for (const agentName of agents) {
    const result = await evaluateAgent(agentName, query);
    console.log(`${agentName}: ${result.score} - ${result.output.slice(0, 100)}...`);
  }
}
```

## Next Steps

1. **Start Simple**: Begin with basic scenarios and gradually add complexity
2. **Iterate Often**: Run evaluations frequently during development
3. **Track Trends**: Monitor scores over time to catch regressions
4. **Share Results**: Make evaluation results visible to the team
5. **Automate**: Integrate evaluations into your CI/CD pipeline

Remember: The goal of evaluation is not just to measure performance, but to drive continuous improvement in your agents.