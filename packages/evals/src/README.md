# Mastra Agent Evaluations

This directory contains Braintrust evaluation scripts organized by agent type.

## Structure

```
evals/
├── agents/
│   ├── experimental/
│   │   ├── a010/         # a010 agent evaluations
│   │   └── a011/         # a011 agent evaluations (task-led workflow)
│   ├── pure/             # Pure function agents
│   └── standalone/       # Standalone agents (math, browser, etc.)
├── shared/
│   ├── scenarios/        # Reusable test scenarios
│   ├── scorers/          # Custom scoring functions
│   └── utils/            # Evaluation utilities
└── results/              # Evaluation results and reports

```

## Running Evaluations

### Local Development (No API Key)
```bash
# Run all a011 evaluations
npx braintrust eval --no-send-logs evals/agents/experimental/a011/task-management.eval.ts

# Run with development UI
npx braintrust eval --dev --dev-port 8300 evals/agents/experimental/a011/task-management.eval.ts
```

### Production (With Braintrust API Key)
```bash
export BRAINTRUST_API_KEY=your-key
npx braintrust eval evals/agents/experimental/a011/task-management.eval.ts
```

## Agent Coverage

- **a010**: Experimental multi-tool agent
- **a011**: Task-led workflow agent with todo management
- **Standalone Agents**: Math, browser, searcher, etc.

## Metrics Tracked

- Relevancy & Accuracy
- Task Completion & Progress Tracking
- Tool Usage Effectiveness
- Response Quality & Safety
- Performance & Error Handling