import { nanoid } from 'nanoid';
import {
  type AgentState,
  type AgentType,
  type Message,
  type OrchestrationState,
} from '../types/index.js';
import { ClaudePtySpawner, stripAnsi } from './pty-spawner.js';

/**
 * Orchestrator using PTY-based interactive Claude
 * Supports full Claude features: slash commands, tab completion, thinking mode, etc.
 */

export class OrchestatorPty {
  private state: OrchestrationState;
  private spawners: Map<AgentType, ClaudePtySpawner | null> = new Map();
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

    // Add visual feedback
    this.addMessage(
      newAgent,
      'system',
      `[Deus] Switched from ${oldAgent === 'claude-code' ? 'Claude Code' : 'Codex'} to ${newAgent === 'claude-code' ? 'Claude Code' : 'Codex'}`
    );

    // Update active agent
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

  // Update session ID
  private updateSessionId(agentType: AgentType, sessionId: string) {
    if (agentType === 'claude-code') {
      this.state = {
        ...this.state,
        claudeCode: {
          ...this.state.claudeCode,
          sessionId,
        },
      };
    } else {
      this.state = {
        ...this.state,
        codex: {
          ...this.state.codex,
          sessionId,
        },
      };
    }

    this.emit();
  }

  // Send message to agent
  async sendToAgent(agentType: AgentType, message: string) {
    // Add user message
    this.addMessage(agentType, 'user', message);
    this.updateAgentStatus(agentType, 'running', 'Processing request...');

    // Notify other agent
    const otherAgent: AgentType = agentType === 'claude-code' ? 'codex' : 'claude-code';
    const agentName = agentType === 'claude-code' ? 'Claude Code' : 'Codex';

    this.addMessage(
      otherAgent,
      'system',
      `[Deus] User sent message to ${agentName}: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`
    );

    const spawner = this.spawners.get(agentType);

    if (spawner && spawner.isRunning()) {
      try {
        // Send message via PTY (like typing in terminal)
        spawner.write(message);

        // Share context
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
      // Mock response if no process
      setTimeout(() => {
        const responses = [
          'I understand. Let me help you with that.',
          'Processing your request...',
          'Analyzing the code...',
        ];

        const response = responses[Math.floor(Math.random() * responses.length)] ?? 'Processing...';
        this.addMessage(agentType, 'assistant', response);
        this.updateAgentStatus(agentType, 'idle');

        this.addMessage(
          otherAgent,
          'system',
          `[Deus] ${agentName} responded: "${response.slice(0, 40)}..."`
        );
      }, 1000 + Math.random() * 2000);
    }
  }

  // Send slash command to agent
  async sendCommand(agentType: AgentType, command: string) {
    const spawner = this.spawners.get(agentType);
    if (spawner && spawner.isRunning()) {
      spawner.sendCommand(command);
      this.addMessage(agentType, 'user', `/${command}`);
    }
  }

  // Send Tab (for thinking mode toggle)
  async sendTab(agentType: AgentType) {
    const spawner = this.spawners.get(agentType);
    if (spawner && spawner.isRunning()) {
      spawner.sendTab();
      this.addMessage(agentType, 'system', '[Sent Tab]');
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

  // Start agent process
  async startAgent(agentType: AgentType) {
    try {
      // Only spawn PTY for Claude Code for now
      if (agentType !== 'claude-code') {
        this.updateAgentStatus(agentType, 'idle', 'Ready (mock mode)');
        this.spawners.set(agentType, null);
        return;
      }

      const command = this.getAgentCommand(agentType);

      // Create PTY spawner
      const spawner = new ClaudePtySpawner({
        cwd: process.cwd(),
        command: command.command,
        onMessage: (role, content) => {
          // Handle structured messages from conversation file
          if (role === 'assistant') {
            this.addMessage(agentType, 'assistant', content);
            this.updateAgentStatus(agentType, 'idle');
          } else if (role === 'system') {
            this.addMessage(agentType, 'system', content);
          }
          // Note: user messages are already added via sendToAgent
        },
        onSessionDetected: (sessionId) => {
          this.updateSessionId(agentType, sessionId);
          this.addMessage(agentType, 'system', `[Session: ${sessionId.substring(0, 8)}...]`);
        },
        onData: (data) => {
          // Raw PTY output - can be used for real-time feedback
          // For now, just log in debug mode
          if (process.env.DEBUG) {
            const clean = stripAnsi(data);
            if (clean.trim()) {
              console.log(`[${agentType} PTY]`, clean);
            }
          }
        },
      });

      this.spawners.set(agentType, spawner);

      // Start the PTY
      await spawner.start();

      this.updateAgentStatus(agentType, 'idle', 'Ready (interactive mode)');
    } catch (error) {
      this.updateAgentStatus(agentType, 'error', 'Failed to start');
      this.addMessage(
        agentType,
        'system',
        `Failed to start: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  // Get agent command configuration
  private getAgentCommand(
    agentType: AgentType
  ): { command: string } {
    if (agentType === 'claude-code') {
      const envCommand = process.env.CLAUDE_CODE_COMMAND || process.env.CLAUDE_COMMAND;
      return { command: envCommand || 'claude' };
    } else {
      return { command: process.env.CODEX_COMMAND || 'codex' };
    }
  }

  // Stop agent process
  async stopAgent(agentType: AgentType) {
    const spawner = this.spawners.get(agentType);
    if (spawner) {
      spawner.cleanup();
      this.spawners.set(agentType, null);
    }
    this.updateAgentStatus(agentType, 'idle');
  }

  // Cleanup all processes
  async cleanup() {
    for (const [agentType] of this.spawners) {
      await this.stopAgent(agentType);
    }
  }
}
