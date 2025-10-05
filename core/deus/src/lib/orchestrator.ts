import { execa } from 'execa';
import { nanoid } from 'nanoid';
import {
  type AgentState,
  type AgentType,
  type Message,
  type OrchestrationState,
} from '../types/index.js';

type ExecaProcess = ReturnType<typeof execa>;

export class Orchestrator {
  private state: OrchestrationState;
  private processes: Map<AgentType, ExecaProcess | null> = new Map();
  private listeners: Set<(state: OrchestrationState) => void> = new Set();

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

  // Emit state changes with new object to trigger React updates
  private emit() {
    // Create a new state object to ensure React detects the change
    this.state = {
      ...this.state,
      claudeCode: { ...this.state.claudeCode },
      codex: { ...this.state.codex },
    };
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

    // Update active agent
    this.state = {
      ...this.state,
      activeAgent: newAgent,
    };

    // Add visual feedback
    this.addMessage(
      newAgent,
      'system',
      `[Deus] Switched from ${oldAgent === 'claude-code' ? 'Claude Code' : 'Codex'} to ${newAgent === 'claude-code' ? 'Claude Code' : 'Codex'}`
    );

    // emit() is called by addMessage, so we don't need to call it again
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
      this.state.claudeCode = {
        ...this.state.claudeCode,
        messages: [...this.state.claudeCode.messages, message],
      };
    } else {
      this.state.codex = {
        ...this.state.codex,
        messages: [...this.state.codex.messages, message],
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
      this.state.claudeCode = {
        ...this.state.claudeCode,
        status,
        currentTask,
      };
    } else {
      this.state.codex = {
        ...this.state.codex,
        status,
        currentTask,
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
        // Send message to agent process via stdin
        process.stdin.write(`${message}\n`);

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

        const response = responses[Math.floor(Math.random() * responses.length)]!;
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
    this.addMessage(
      this.state.activeAgent,
      'system',
      `Shared context: ${key}`
    );
    // emit() is called by addMessage, so we don't need to call it again
  }

  // Clear agent messages
  clearAgent(agentType: AgentType) {
    if (agentType === 'claude-code') {
      this.state.claudeCode = {
        ...this.state.claudeCode,
        messages: [],
        currentTask: undefined,
      };
    } else {
      this.state.codex = {
        ...this.state.codex,
        messages: [],
        currentTask: undefined,
      };
    }

    this.emit();
  }

  // Start actual agent process
  async startAgent(agentType: AgentType) {
    try {
      // Get agent command (defaults to 'claude' or 'codex')
      const agentCommand = this.getAgentCommand(agentType);

      // Don't spawn processes for now - just show ready state
      // TODO: Add proper agent process integration later
      this.updateAgentStatus(agentType, 'idle', 'Ready (mock mode)');
      this.processes.set(agentType, null);
      return;

      // Spawn the agent process
      const process = execa(agentCommand.command, agentCommand.args, {
        stdio: 'pipe',
        reject: false,
        all: true,
      });

      this.processes.set(agentType, process);

      // Handle stdout - assistant messages
      if (process.stdout) {
        process.stdout.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          if (output) {
            this.addMessage(agentType, 'assistant', output);
            this.updateAgentStatus(agentType, 'idle');
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
      return { command, args: [] };
    } else {
      // codex
      const command = process.env.CODEX_COMMAND || 'codex'; // Default to 'codex'
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
