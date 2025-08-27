# Lightfast CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@lightfastai/cli.svg)](https://www.npmjs.com/package/@lightfastai/cli)
[![GitHub issues](https://img.shields.io/github/issues/lightfastai/lightfast)](https://github.com/lightfastai/lightfast/issues)

Command-line interface for the Lightfast agent execution engine - enabling developers to build, test, and deploy AI agents directly from the terminal.

## About

The Lightfast CLI provides a streamlined development experience for working with AI agents locally. It combines the power of the Lightfast execution engine with a modern web-based UI built on TanStack Start, delivering a seamless workflow for agent development.

### Key Features

- 🎨 **Web-based UI**: Beautiful interface powered by TanStack Start and React 19
- 🔄 **Hot Reload**: Live updates during development
- 🛠️ **Developer Tools**: Built-in debugging and monitoring capabilities
- ⚡ **Fast Iteration**: Test agents locally before deploying to production

## Installation

```bash
# Install globally via npm
npm install -g @lightfastai/cli

# Or use pnpm
pnpm add -g @lightfastai/cli

# Or run directly with npx (recommended)
npx @lightfastai/cli dev
```

## Usage

### Quick Start

```bash
# Start the development server on default port 3000
npx @lightfastai/cli dev

# Start on a custom port
npx @lightfastai/cli dev --port 4000

# Bind to all network interfaces
npx @lightfastai/cli dev --host 0.0.0.0
```

### In Your Project

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "dev": "@lightfastai/cli dev",
    "dev:custom": "@lightfastai/cli dev --port 4000"
  }
}
```

Then run:
```bash
npm run dev
# or
pnpm dev
```

## Commands

### `dev`
Start the Lightfast development server with hot reload. Opens a web UI for viewing and managing your Lightfast agents.

**Options:**
- `-p, --port <port>` - Port to run the server on (default: 3000)
- `-h, --host <host>` - Host to bind the server to (default: localhost)

**Examples:**
```bash
# Default settings
npx @lightfastai/cli dev

# Custom port
npx @lightfastai/cli dev --port 8080

# Allow network access
npx @lightfastai/cli dev --host 0.0.0.0 --port 3000
```

### `help`
Display help information and available commands.

```bash
npx @lightfastai/cli help
```

## Development UI

The CLI includes a web-based development interface built with:
- **TanStack Start**: Full-stack React framework
- **React 19**: Latest React features and performance
- **Tailwind CSS v4**: Modern styling system
- **TypeScript**: Full type safety

Access the UI at `http://localhost:3000` when running `cli dev`.

## Requirements

- **Node.js**: >= 18.0.0
- **npm/pnpm**: Latest version
- **OS**: macOS, Linux, or Windows

## Documentation

For detailed documentation, visit [lightfast.ai/docs](https://lightfast.ai/docs)

## Support

- **Documentation**: [lightfast.ai/docs](https://lightfast.ai/docs)
- **GitHub Issues**: [github.com/lightfastai/lightfast/issues](https://github.com/lightfastai/lightfast/issues)
- **Discord**: [Join our community](https://discord.gg/YqPDfcar2C)

## License

MIT - See [LICENSE](LICENSE) for details.

---

**Part of the [Lightfast](https://github.com/lightfastai/lightfast) ecosystem**