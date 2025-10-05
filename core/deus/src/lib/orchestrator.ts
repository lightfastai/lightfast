import { execa, type ExecaChildProcess } from 'execa';
import { nanoid } from 'nanoid';
import {
  type AgentState,
  type AgentType,
  type Message,
  type OrchestrationState,
} from '../types/index.js';

export class Orchestrator {
  private state: OrchestrationState;
  private processes: Map<AgentType, ExecaChildProcess | null> = new Map();
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

  // Emit state changes
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
    this.state.activeAgent =
      this.state.activeAgent === 'claude-code' ? 'codex' : 'claude-code';

    // Add visual feedback
    this.addMessage(
      this.state.activeAgent,
      'system',
      `[Deus] Switched from ${oldAgent === 'claude-code' ? 'Claude Code' : 'Codex'} to ${this.state.activeAgent === 'claude-code' ? 'Claude Code' : 'Codex'}`
    );

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
      this.state.claudeCode.messages.push(message);
    } else {
      this.state.codex.messages.push(message);
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
      this.state.claudeCode.status = status;
      this.state.claudeCode.currentTask = currentTask;
    } else {
      this.state.codex.status = status;
      this.state.codex.currentTask = currentTask;
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

        const response = responses[Math.floor(Math.random() * responses.length)];
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
    this.state.sharedContext[key] = value;
    this.addMessage(
      this.state.activeAgent,
      'system',
      `Shared context: ${key}`
    );
    this.emit();
  }

  // Clear agent messages
  clearAgent(agentType: AgentType) {
    if (agentType === 'claude-code') {
      this.state.claudeCode.messages = [];
      this.state.claudeCode.currentTask = undefined;
    } else {
      this.state.codex.messages = [];
      this.state.codex.currentTask = undefined;
    }

    this.emit();
  }

  // Start actual agent process
  async startAgent(agentType: AgentType) {
    try {
      // Get agent command (defaults to 'claude' or 'codex')
      const agentCommand = this.getAgentCommand(agentType);

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

      // Handle stderr - system/error messages
      if (process.stderr) {
        process.stderr.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          if (output) {
            this.addMessage(agentType, 'system', output);
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

      // Handle process errors
      process.on('error', (error) => {
        this.addMessage(
          agentType,
          'system',
          `Process error: ${error.message}`
        );
        this.updateAgentStatus(agentType, 'error', error.message);
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
