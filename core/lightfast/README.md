# @lightfastai/core

AI agents, tools, and workflows for Lightfast v1.

## Installation

```bash
npm install @lightfastai/core
# or
pnpm add @lightfastai/core
# or  
yarn add @lightfastai/core
```

## Quick Start

```typescript
import { createAgent } from '@lightfastai/core/agent';
import { createTool } from '@lightfastai/core/tool';

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