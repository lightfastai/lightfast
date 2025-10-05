import { execa } from 'execa';
import { nanoid } from 'nanoid';
import {
  type AgentState,
  type AgentType,
  type Message,
  type OrchestrationState,
} from '../types/index.js';

type ExecaProcess = ReturnType<typeof execa>;

// Helper to format message for Claude Code streaming JSON input
function formatClaudeMessage(text: string): string {
  const message = {
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          type: 'text',
          text,
        },
      ],
    },
  };
  return JSON.stringify(message) + '\n';
}

// Helper to strip ANSI escape codes
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export class Orchestrator {
  private state: OrchestrationState;
  private processes: Map<AgentType, ExecaProcess | null> = new Map();
  private listeners: Set<(state: OrchestrationState) => void> = new Set();
  private lineBuffers: Map<AgentType, string> = new Map();

  constructor() {
    this.state = {
      claudeCode: this.createInitialAgentState('claude-code'),
      codex: this.createInitialAgentState('codex'),
      activeAgent: 'claude-code',
      sharedContext: {},
    };
  }

  private createInitialAgentState(type: AgentType): AgentState {
    return {
      type,
      status: 'idle',
      messages: [],
    };
  }

  // Subscribe to state changes
  subscribe(listener: (state: OrchestrationState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Emit state changes to listeners
  private emit() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // Get current state
  getState(): OrchestrationState {
    return this.state;
  }

  // Switch active agent
  switchAgent() {
    const oldAgent = this.state.activeAgent;
    const newAgent: AgentType =
      this.state.activeAgent === 'claude-code' ? 'codex' : 'claude-code';

    // Add visual feedback (this will emit state change)
    this.addMessage(
      newAgent,
      'system',
      `[Deus] Switched from ${oldAgent === 'claude-code' ? 'Claude Code' : 'Codex'} to ${newAgent === 'claude-code' ? 'Claude Code' : 'Codex'}`
    );

    // Update active agent after message is added
    this.state = {
      ...this.state,
      activeAgent: newAgent,
    };

    this.emit();
  }

  // Add message to agent
  addMessage(agentType: AgentType, role: Message['role'], content: string) {
    const message: Message = {
      id: nanoid(),
      role,
      content,
      timestamp: new Date(),
      agentType,
    };

    if (agentType === 'claude-code') {
      this.state = {
        ...this.state,
        claudeCode: {
          ...this.state.claudeCode,
          messages: [...this.state.claudeCode.messages, message],
        },
      };
    } else {
      this.state = {
        ...this.state,
        codex: {
          ...this.state.codex,
          messages: [...this.state.codex.messages, message],
        },
      };
    }

    this.emit();
  }

  // Update agent status
  updateAgentStatus(
    agentType: AgentType,
    status: AgentState['status'],
    currentTask?: string
  ) {
    if (agentType === 'claude-code') {
      this.state = {
        ...this.state,
        claudeCode: {
          ...this.state.claudeCode,
          status,
          currentTask,
        },
      };
    } else {
      this.state = {
        ...this.state,
        codex: {
          ...this.state.codex,
          status,
          currentTask,
        },
      };
    }

    this.emit();
  }

  // Send command to agent with coordination
  async sendToAgent(agentType: AgentType, message: string) {
    // Add user message to active agent
    this.addMessage(agentType, 'user', message);
    this.updateAgentStatus(agentType, 'running', 'Processing request...');

    // Coordinate with other agent - notify about the interaction
    const otherAgent: AgentType = agentType === 'claude-code' ? 'codex' : 'claude-code';
    const agentName = agentType === 'claude-code' ? 'Claude Code' : 'Codex';

    this.addMessage(
      otherAgent,
      'system',
      `[Deus] User sent message to ${agentName}: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`
    );

    const process = this.processes.get(agentType);

    if (process && process.stdin) {
      try {
        // Format message for Claude Code streaming JSON
        const formattedMessage = agentType === 'claude-code'
          ? formatClaudeMessage(message)
          : `${message}\n`;

        // Send message to agent process via stdin
        process.stdin.write(formattedMessage);

        // Share context with other agent
        this.shareContext(`last-message-${agentType}`, {
          from: agentType,
          message,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.addMessage(
          agentType,
          'system',
          `Error sending message: ${error instanceof Error ? error.message : String(error)}`
        );
        this.updateAgentStatus(agentType, 'error', 'Failed to send message');
      }
    } else {
      // If no process, add mock response for testing
      setTimeout(() => {
        const responses = [
          'I understand. Let me help you with that.',
          'Processing your request...',
          'Analyzing the code...',
          'Running the command...',
        ];

        const response = responses[Math.floor(Math.random() * responses.length)] ?? 'Processing...';
        this.addMessage(agentType, 'assistant', response);
        this.updateAgentStatus(agentType, 'idle');

        // Notify other agent about response
        this.addMessage(
          otherAgent,
          'system',
          `[Deus] ${agentName} responded: "${response.slice(0, 40)}..."`
        );
      }, 1000 + Math.random() * 2000);
    }
  }

  // Share context between agents
  shareContext(key: string, value: unknown) {
    this.state = {
      ...this.state,
      sharedContext: {
        ...this.state.sharedContext,
        [key]: value,
      },
    };

    this.emit();

    // Add message after context is shared
    this.addMessage(
      this.state.activeAgent,
      'system',
      `Shared context: ${key}`
    );
  }

  // Clear agent messages
  clearAgent(agentType: AgentType) {
    if (agentType === 'claude-code') {
      this.state = {
        ...this.state,
        claudeCode: {
          ...this.state.claudeCode,
          messages: [],
          currentTask: undefined,
        },
      };
    } else {
      this.state = {
        ...this.state,
        codex: {
          ...this.state.codex,
          messages: [],
          currentTask: undefined,
        },
      };
    }

    this.emit();
  }

  // Start actual agent process
  async startAgent(agentType: AgentType) {
    try {
      // Get agent command (defaults to 'claude' or 'codex')
      const agentCommand = this.getAgentCommand(agentType);

      // Only spawn process for Claude Code for now
      if (agentType !== 'claude-code') {
        this.updateAgentStatus(agentType, 'idle', 'Ready (mock mode)');
        this.processes.set(agentType, null);
        return;
      }

      // Spawn the agent process
      const process = execa(agentCommand.command, agentCommand.args, {
        stdio: 'pipe',
        reject: false,
        all: true,
      });

      this.processes.set(agentType, process);

      // Initialize line buffer for this agent
      this.lineBuffers.set(agentType, '');

      // Handle stdout - parse streaming JSON for Claude Code
      if (process.stdout) {
        process.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();

          if (agentType === 'claude-code') {
            // Buffer and parse line by line for streaming JSON
            const buffer = this.lineBuffers.get(agentType) ?? '';
            const newBuffer = buffer + chunk;
            const lines = newBuffer.split('\n');

            // Keep the last incomplete line in buffer
            this.lineBuffers.set(agentType, lines.pop() ?? '');

            // Process complete lines
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              try {
                const json = JSON.parse(trimmed);

                // Handle different message types from Claude Code
                if (json.type === 'assistant' && json.message?.content) {
                  // Extract text content from assistant messages
                  const textContent = json.message.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('');

                  if (textContent) {
                    const cleanText = stripAnsi(textContent);
                    this.addMessage(agentType, 'assistant', cleanText);
                    this.updateAgentStatus(agentType, 'idle');
                  }
                } else if (json.type === 'result') {
                  // Final result message
                  this.updateAgentStatus(agentType, 'idle', 'Completed');
                }
              } catch (parseError) {
                // If JSON parse fails, treat as plain text
                const cleanOutput = stripAnsi(trimmed);
                if (cleanOutput) {
                  this.addMessage(agentType, 'assistant', cleanOutput);
                }
              }
            }
          } else {
            // For non-Claude Code agents, use simple text parsing
            const output = stripAnsi(chunk.trim());
            if (output) {
              this.addMessage(agentType, 'assistant', output);
              this.updateAgentStatus(agentType, 'idle');
            }
          }
        });
      }

      // Handle stderr - system/error messages (limit to prevent spam)
      let stderrCount = 0;
      const MAX_STDERR = 3;
      if (process.stderr) {
        process.stderr.on('data', (data: Buffer) => {
          if (stderrCount >= MAX_STDERR) return;
          const output = data.toString().trim();
          if (output) {
            this.addMessage(agentType, 'system', output);
            stderrCount++;
            if (stderrCount >= MAX_STDERR) {
              this.addMessage(agentType, 'system', '[Additional stderr output suppressed]');
            }
          }
        });
      }

      // Handle process exit
      process.on('exit', (code) => {
        if (code === 0) {
          this.updateAgentStatus(agentType, 'idle', 'Process exited');
        } else {
          this.updateAgentStatus(
            agentType,
            'error',
            `Process exited with code ${code ?? 'unknown'}`
          );
        }
        this.processes.set(agentType, null);
      });

      // Handle process errors (command not found, etc)
      process.on('error', (error) => {
        this.addMessage(
          agentType,
          'system',
          `Failed to start: ${error.message}`
        );
        this.updateAgentStatus(agentType, 'error', 'Command not found');
        // Kill the process to stop further errors
        process.kill();
        this.processes.set(agentType, null);
      });

      this.updateAgentStatus(agentType, 'idle', 'Ready');
    } catch (error) {
      this.updateAgentStatus(agentType, 'error', 'Failed to start');
      throw error;
    }
  }

  // Get agent command configuration
  private getAgentCommand(
    agentType: AgentType
  ): { command: string; args: string[] } {
    // Check environment variables for custom commands (allows override)
    if (agentType === 'claude-code') {
      const envCommand = process.env.CLAUDE_CODE_COMMAND || process.env.CLAUDE_COMMAND;
      const command = envCommand || 'claude'; // Default to 'claude'
      return {
        command,
        args: [
          '-p',
          '--output-format', 'stream-json',
          '--input-format', 'stream-json',
          '--verbose',
        ],
      };
    } else {
      // codex - not implemented yet
      const command = process.env.CODEX_COMMAND || 'codex';
      return { command, args: [] };
    }
  }

  // Stop agent process
  async stopAgent(agentType: AgentType) {
    const process = this.processes.get(agentType);
    if (process) {
      process.kill();
      this.processes.set(agentType, null);
    }
    this.updateAgentStatus(agentType, 'idle');
  }

  // Cleanup all processes
  async cleanup() {
    for (const [agentType] of this.processes) {
      await this.stopAgent(agentType);
    }
  }
}
