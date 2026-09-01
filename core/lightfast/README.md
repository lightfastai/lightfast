# lightfast

TypeScript SDK for the Lightfast API.

[![npm version](https://img.shields.io/npm/v/lightfast.svg)](https://www.npmjs.com/package/lightfast)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

## Installation

```bash
npm install lightfast
# or
pnpm add lightfast
```

## Development

```bash
pnpm build   # Build
pnpm dev     # Watch mode
pnpm test    # Run tests
```

## Requirements

- **Node.js** >= 18
- **TypeScript** >= 5.0

## Usage

Lightfast does not assume a hosted API. Pass the base URL of the compatible
backend you intend to use:

```typescript
import { createLightfast } from "lightfast";

const lightfast = createLightfast(process.env.LIGHTFAST_API_KEY!, {
  baseUrl: process.env.LIGHTFAST_API_URL!,
});

const health = await lightfast.system.health();
```

## Links

- **Website**: [lightfast.ai](https://lightfast.ai)
- **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs)
- **GitHub**: [github.com/lightfastai/lightfast](https://github.com/lightfastai/lightfast)
- **npm**: [npmjs.com/package/lightfast](https://www.npmjs.com/package/lightfast)

## Related Packages

- **[@lightfastai/mcp](https://www.npmjs.com/package/@lightfastai/mcp)** - MCP server for AI assistants

## License

MIT © [Lightfast](https://lightfast.ai)
