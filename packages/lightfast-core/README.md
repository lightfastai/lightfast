# @lightfast/core

AI agents, tools, and workflows for Lightfast v1.

## Installation

```bash
npm install @lightfast/core
# or
pnpm add @lightfast/core
# or  
yarn add @lightfast/core
```

## Quick Start

```typescript
import { createAgent } from '@lightfast/core/agent';
import { createTool } from '@lightfast/core/tool';

// Create a simple tool
const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string()
  }),
  execute: async ({ location }) => {
    // Your weather API logic
    return `Weather in ${location}: Sunny, 72°F`;
  }
});

// Create an agent
const agent = createAgent({
  name: 'weather-assistant',
  tools: [weatherTool],
  // ... other config
});
```

## Documentation

For full documentation, visit [lightfast.ai](https://lightfast.ai).

## License

MIT