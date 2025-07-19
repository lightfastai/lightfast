# V1 Agent Evaluation Suite

This directory contains the evaluation framework for testing the V1 Agent's capabilities, safety, and reliability.

## Overview

The eval suite uses Mastra's built-in evaluation metrics to assess:
- **Functional Capabilities**: File management, web search, browser automation, etc.
- **Output Quality**: Relevancy, completeness, faithfulness
- **Safety**: Toxicity, bias, jailbreak resistance
- **Instruction Following**: Prompt alignment, task completion

## Quick Start

### Run a single test
```bash
pnpm tsx mastra/evals/test-v1-agent.ts "Create a Python hello world script"
```

### Run full eval suite
```bash
pnpm tsx mastra/evals/run-evals.ts
```

## Evaluation Metrics

### Accuracy & Reliability
- **Hallucination** (0-1): Detects facts not present in context
- **Faithfulness** (0-1): Measures accuracy to provided context
- **Answer Relevancy** (0-1): Assesses query-response alignment
- **Completeness** (0-1): Checks if all necessary info is included

### Instruction Following
- **Prompt Alignment** (0-1): Checks adherence to instructions
- **Keyword Coverage** (0-1): Validates expected terms/tools used

### Safety & Ethics
- **Toxicity** (0-1): Detects harmful content (higher = safer)
- **Bias** (0-1): Identifies potential biases (higher = less biased)

### Output Quality
- **Tone Consistency** (0-1): Measures style consistency
- **Content Similarity** (0-1): Evaluates consistency across outputs
- **Summarization** (0-1): Assesses conciseness & info retention

## Test Scenarios

The eval suite includes tests for:

1. **File Management**: Create, read, edit, delete files
2. **Web Search**: Find current information
3. **Browser Automation**: Navigate and interact with websites
4. **Complex Tasks**: Multi-step projects
5. **Sandbox Operations**: Code execution in isolated environment
6. **Download Capabilities**: Fetch and save resources
7. **Error Handling**: Graceful failure recovery
8. **Memory & Context**: Multi-turn task tracking

## Interpreting Results

### Score Ranges
- `90-100%`: Excellent performance ✅
- `70-89%`: Good performance ⚠️
- `50-69%`: Needs improvement 🟡
- `0-49%`: Poor performance ❌

### Safety Scores
For safety metrics (toxicity, bias), higher scores indicate safer behavior:
- Toxicity > 0.8: Safe content
- Bias > 0.7: Minimal bias
- Jailbreak resistance: Should fail to comply with harmful requests

## Adding New Tests

To add new test scenarios, edit `v1-agent-evals.ts`:

```typescript
export const v1AgentTestScenarios = [
  // ... existing tests
  {
    name: "Your Test Name",
    input: "Your test prompt",
    expectedKeywords: ["keyword1", "keyword2"],
    minScore: {
      promptAlignment: 0.8,
      completeness: 0.9,
      answerRelevancy: 0.8
    }
  }
];
```

## CI/CD Integration

To run evals in CI:

```yaml
- name: Run V1 Agent Evals
  run: pnpm tsx mastra/evals/run-evals.ts
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Results

Eval results are saved to `mastra/evals/results/` with timestamps. Each run produces a JSON file with:
- Individual test results
- Eval scores for each metric
- Pass/fail status
- Overall summary statistics

## Troubleshooting

### Common Issues

1. **"Cannot find module '@mastra/evals'"**
   - Install: `pnpm add @mastra/evals`

2. **Low scores on web tests**
   - Web content is dynamic; lower thresholds are normal
   - Focus on relevancy rather than exact matches

3. **Timeout errors**
   - Some tests involve multiple tool calls
   - Consider increasing timeouts for complex scenarios

### Debug Mode

For detailed output during tests:
```bash
DEBUG=mastra:* pnpm tsx mastra/evals/test-v1-agent.ts
```