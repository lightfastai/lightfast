/**
 * Deus Command System
 * Handles slash commands like /status, /help, etc.
 */

import type { OrchestratorState } from './orchestrator.js';
import type { DeusSessionState } from '../types/index.js';

export interface CommandContext {
  orchestratorState: OrchestratorState;
  sessionState: DeusSessionState | null;
}

export interface CommandResult {
  success: boolean;
  message: string;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  execute: (context: CommandContext, args: string[]) => Promise<CommandResult> | CommandResult;
}

/**
 * Command Registry
 */
class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    // Register main name
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  getAll(): Command[] {
    // Return unique commands (no duplicates from aliases)
    const seen = new Set<Command>();
    const commands: Command[] = [];

    for (const command of this.commands.values()) {
      if (!seen.has(command)) {
        seen.add(command);
        commands.push(command);
      }
    }

    return commands;
  }
}

// Global registry instance
const registry = new CommandRegistry();

/**
 * /help command - Show available commands
 */
const helpCommand: Command = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands and usage information',
  execute: () => {
    const commands = registry.getAll();

    const lines = [
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '  Deus Command Reference',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'Available Commands:',
      '',
    ];

    // List all commands
    for (const cmd of commands) {
      const aliasText = cmd.aliases?.length
        ? ` (aliases: ${cmd.aliases.join(', ')})`
        : '';
      lines.push(`  /${cmd.name}${aliasText}`);
      lines.push(`    ${cmd.description}`);
      lines.push('');
    }

    lines.push('Usage:');
    lines.push('  • Type commands with a leading slash: /status');
    lines.push('  • Type "back" or "return" to return to Deus from an agent');
    lines.push('  • Press Ctrl+B to quickly return to Deus');
    lines.push('  • Press Ctrl+C to exit');
    lines.push('');
    lines.push('Agent Routing:');
    lines.push('  • Tell Deus what you want to do, and it will route to the right agent');
    lines.push('  • Examples: "Review this code", "Write tests", "Debug this error"');
    lines.push('');

    return {
      success: true,
      message: lines.join('\n'),
    };
  },
};

/**
 * /status command - Show session status
 */
const statusCommand: Command = {
  name: 'status',
  aliases: ['s', 'info'],
  description: 'Show current session status and information',
  execute: (context) => {
    const { orchestratorState, sessionState } = context;

    const data: Array<{ label: string; value: string }> = [];

    // Active Agent
    data.push({
      label: 'Active Agent',
      value: getAgentDisplayName(orchestratorState.activeAgent),
    });

    // Session ID
    if (orchestratorState.sessionId) {
      data.push({
        label: 'Session',
        value: orchestratorState.sessionId.substring(0, 24) + '...',
      });
    }

    // Session Status
    if (sessionState) {
      data.push({
        label: 'Status',
        value: sessionState.status,
      });

      // Calculate session duration
      const duration = Date.now() - new Date(sessionState.createdAt).getTime();
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      data.push({
        label: 'Duration',
        value: `${minutes}m ${seconds}s`,
      });
    }

    // Working Directory
    if (sessionState?.metadata.cwd) {
      data.push({
        label: 'Directory',
        value: sessionState.metadata.cwd,
      });
    }

    // Git Branch
    if (sessionState?.metadata.branch) {
      data.push({
        label: 'Branch',
        value: sessionState.metadata.branch,
      });
    }

    // Job Type
    if (orchestratorState.jobType) {
      data.push({
        label: 'Job Type',
        value: orchestratorState.jobType,
      });
    }

    // MCP Servers
    if (orchestratorState.mcpServers.length > 0) {
      data.push({
        label: 'MCP Servers',
        value: orchestratorState.mcpServers.join(', '),
      });
    }

    // Linked Agents
    if (sessionState?.linkedAgents.length) {
      const agentInfo = sessionState.linkedAgents
        .map(agent => {
          const agentName = getAgentDisplayName(agent.agentType);
          const sessionId = agent.sessionId.substring(0, 8);
          return `${agentName} (${sessionId}...)`;
        })
        .join(', ');

      data.push({
        label: 'Linked',
        value: agentInfo,
      });
    }

    // Tasks
    if (sessionState?.tasks.length) {
      const pendingTasks = sessionState.tasks.filter(t => t.status === 'pending').length;
      const inProgressTasks = sessionState.tasks.filter(t => t.status === 'in_progress').length;
      const completedTasks = sessionState.tasks.filter(t => t.status === 'completed').length;

      data.push({
        label: 'Tasks',
        value: `${sessionState.tasks.length} total (${pendingTasks} pending, ${inProgressTasks} in progress, ${completedTasks} done)`,
      });
    }

    // Message Count
    const userMessages = orchestratorState.messages.filter(m => m.role === 'user').length;
    const assistantMessages = orchestratorState.messages.filter(m => m.role === 'assistant').length;
    data.push({
      label: 'Messages',
      value: `${orchestratorState.messages.length} total (${userMessages} user, ${assistantMessages} assistant)`,
    });

    // Build the box
    const message = buildStatusBox(data);

    return {
      success: true,
      message,
    };
  },
};

/**
 * Build a bordered box for status display
 */
function buildStatusBox(data: Array<{ label: string; value: string }>): string {
  // Find the longest label for alignment
  const maxLabelLength = Math.max(...data.map(d => d.label.length));

  // Calculate box width based on content
  const maxValueLength = Math.max(...data.map(d => d.value.length));
  const contentWidth = Math.max(maxLabelLength + maxValueLength + 3, 50); // 3 = ": " + space

  const topBorder = '┌' + '─'.repeat(contentWidth + 2) + '┐';
  const bottomBorder = '└' + '─'.repeat(contentWidth + 2) + '┘';

  const lines = [topBorder];

  // Add each data row
  for (const item of data) {
    const paddedLabel = item.label.padEnd(maxLabelLength);
    const line = `│ ${paddedLabel}: ${item.value}`.padEnd(contentWidth + 3) + '│';
    lines.push(line);
  }

  lines.push(bottomBorder);

  return lines.join('\n');
}

/**
 * Helper: Get display name for agent
 */
function getAgentDisplayName(agent: string): string {
  switch (agent) {
    case 'deus':
      return 'Deus (Router)';
    case 'claude-code':
      return 'Claude Code';
    case 'codex':
      return 'Codex';
    default:
      return agent;
  }
}

/**
 * Register built-in commands
 */
registry.register(helpCommand);
registry.register(statusCommand);

/**
 * Check if message is a command
 */
export function isCommand(message: string): boolean {
  return message.trim().startsWith('/');
}

/**
 * Parse command from message
 */
export function parseCommand(message: string): { name: string; args: string[] } {
  const trimmed = message.trim();

  if (!trimmed.startsWith('/')) {
    throw new Error('Not a command');
  }

  // Remove leading slash
  const withoutSlash = trimmed.substring(1);

  // Split by whitespace
  const parts = withoutSlash.split(/\s+/);

  const name = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  return { name, args };
}

/**
 * Execute a command
 */
export async function executeCommand(
  message: string,
  context: CommandContext
): Promise<CommandResult> {
  try {
    const { name, args } = parseCommand(message);

    if (!name) {
      return {
        success: false,
        message: 'Invalid command. Type /help for available commands.',
      };
    }

    const command = registry.get(name);

    if (!command) {
      return {
        success: false,
        message: `Unknown command: /${name}\nType /help for available commands.`,
      };
    }

    return await command.execute(context, args);
  } catch (error) {
    return {
      success: false,
      message: `Command error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Register a new command
 */
export function registerCommand(command: Command): void {
  registry.register(command);
}

/**
 * Get all registered commands
 */
export function getAllCommands(): Command[] {
  return registry.getAll();
}
