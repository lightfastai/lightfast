# Deus - AI Agent Orchestrator

> Terminal-based UI for orchestrating multiple AI agents (Claude Code & Codex) in a single interface

## Overview

Deus is a TUI (Terminal User Interface) application built with Ink (React for CLIs) that provides a dual-panel interface for orchestrating and coordinating multiple AI agents simultaneously. It enables developers to work with Claude Code and Codex side-by-side, share context between them, and manage their interactions seamlessly.

## Features

- **Dual-Panel Layout**: Side-by-side view of Claude Code and Codex agents
- **Active Agent Indication**: Double border and highlighted header for the active agent
- **Real-Time Status**: Live indicators showing agent state (idle, running, waiting, error)
- **Message History**: Last 5 messages displayed per agent
- **Keyboard Controls**: Quick navigation and context sharing
- **Process Integration**: Spawns and communicates with real agent processes
- **Agent Coordination**: Messages to one agent notify the other agent automatically
- **Context Sharing**: Share information between agents with Ctrl+S
- **Customizable Commands**: Override default commands via environment variables

## Quick Start

```bash
# Navigate to deus directory
cd core/deus

# Install dependencies
pnpm install

# Run the TUI (spawns 'claude' and 'codex' processes)
pnpm dev
```

## Keyboard Shortcuts

- **Tab** - Switch between Claude Code and Codex (UI updates to show active agent)
- **Enter** - Send message to active agent (automatically coordinates with other agent)
- **Ctrl+C** - Exit application
- **Ctrl+S** - Share context between agents
- **Ctrl+K** - Clear active agent messages

## How Coordination Works

When you send a message to one agent (e.g., Claude Code), Deus automatically:
1. Sends your message to the active agent
2. Notifies the other agent (e.g., Codex) with a system message
3. Shares the message context in the orchestrator's shared state
4. When the active agent responds, notifies the other agent about the response

This enables both agents to be aware of what the other is doing, facilitating coordinated work.

## Configuration

Deus uses these commands by default:
- **Claude Code**: `claude`
- **Codex**: `codex`

To override with custom commands, set environment variables:

```bash
# Custom Claude Code command
export CLAUDE_CODE_COMMAND=/path/to/custom-claude
# or
export CLAUDE_COMMAND=/path/to/custom-claude

# Custom Codex command
export CODEX_COMMAND=/path/to/custom-codex
```

## Architecture

- **Ink v6.3.1** - React for building terminal interfaces
- **React 19.1.1** - UI component model
- **Execa** - Process spawning and management
- **Zod** - Runtime type validation
- **TypeScript** - Type safety

## Project Structure

```
core/deus/
├── src/
│   ├── components/      # React components (agent-panel, input-bar, etc.)
│   ├── lib/            # Core logic (orchestrator)
│   ├── types/          # Zod schemas & TypeScript types
│   ├── cli.tsx         # CLI entry point
│   └── index.ts        # Library exports
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Documentation

See [SETUP.md](./SETUP.md) for detailed setup instructions, integration status, and development guide.

## Inspiration

Based on [sst/opencode](https://github.com/sst/opencode) architecture, adapted to TypeScript/JavaScript ecosystem using Ink instead of Bubble Tea (Go).

## License

Part of the Lightfast AI project.
