/**
 * Basic Orchestrator (Direct Agent Control)
 *
 * USE THIS FOR:
 * - Headless mode / CLI usage
 * - Direct agent control without Deus router
 * - Programmatic agent interaction
 * - Simple single-agent workflows
 *
 * For the full Deus experience with smart routing, use SimpleOrchestrator instead.
 */

import { nanoid } from 'nanoid';
import {
  type AgentState,
  type AgentType,
  type Message,
  type OrchestrationState,
} from '../types/index.js';
import { ClaudePtySpawner, stripAnsi } from './spawners/claude-spawner.js';
import { CodexPtySpawner } from './spawners/codex-spawner.js';
import { SessionManager } from './session/session-manager.js';

export class Orchestrator {
  private state: OrchestrationState;
  private spawners: Map<AgentType, ClaudePtySpawner | CodexPtySpawner | null> = new Map();
  private listeners: Set<(state: OrchestrationState) => void> = new Set();
  private sessionManager: SessionManager | null = null;

  constructor(sessionManager?: SessionManager) {
    this.state = {
      claudeCode: this.createInitialAgentState('claude-code'),
      codex: this.createInitialAgentState('codex'),
      activeAgent: 'claude-code',
      sharedContext: {},
    };

    if (sessionManager) {
      this.sessionManager = sessionManager;
    }
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
  async switchAgent() {
    const oldAgent = this.state.activeAgent;
    const newAgent: AgentType =
      this.state.activeAgent === 'claude-code' ? 'codex' : 'claude-code';

    // Record agent switch in session
    if (this.sessionManager) {
      await this.sessionManager.recordAgentSwitch(oldAgent, newAgent);
    }

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

  // Update session ID
  private async updateSessionId(agentType: AgentType, sessionId: string) {
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

    const spawner = this.spawners.get(agentType);

    if (process.env.DEBUG) {
      console.log(`[Orchestrator] sendToAgent: agent=${agentType}, spawner exists=${!!spawner}, isRunning=${spawner?.isRunning()}`);
      console.log(`[Orchestrator] Available spawners:`, Array.from(this.spawners.keys()));
    }

    if (spawner && spawner.isRunning()) {
      if (process.env.DEBUG) {
        console.log(`[Orchestrator] Calling spawner.write("${message}")`);
      }

      try {
        // Send message via PTY (like typing in terminal)
        await spawner.write(message);

        // Share context with other agent
        await this.shareContext(`last-message-${agentType}`, {
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
      // If no spawner, add mock response for testing
      if (process.env.DEBUG) {
        console.log(`[Orchestrator] No running spawner for ${agentType}, using mock response`);
      }

      this.addMessage(
        agentType,
        'system',
        `⚠️ ${agentType === 'claude-code' ? 'Claude Code' : 'Codex'} is not running (showing mock response)`
      );

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
  async shareContext(key: string, value: unknown) {
    // Store in session
    if (this.sessionManager) {
      await this.sessionManager.shareContext(key, value);
    }

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
      this.updateAgentStatus(agentType, 'idle', 'Starting...');

      const command = this.getAgentCommand(agentType);

      if (process.env.DEBUG) {
        console.log(`[Orchestrator] Starting ${agentType} with command: ${command.command}`);
      }

      // Create appropriate PTY spawner based on agent type
      const spawner = agentType === 'claude-code'
        ? new ClaudePtySpawner({
            cwd: process.cwd(),
            command: command.command,
            onMessage: (role, content) => {
              // Handle structured messages from conversation file
              if (process.env.DEBUG) {
                console.log(`[Orchestrator] Received message: role=${role}, content=${content.slice(0, 50)}...`);
              }

              if (role === 'assistant') {
                this.addMessage(agentType, 'assistant', content);
                this.updateAgentStatus(agentType, 'idle');
              } else if (role === 'system') {
                this.addMessage(agentType, 'system', content);
              }
              // Note: user messages are already added via sendToAgent
            },
            onSessionDetected: async (sessionId, filePath) => {
              await this.updateSessionId(agentType, sessionId);

              // Link agent session to Deus session
              if (this.sessionManager && filePath) {
                await this.sessionManager.linkAgent(agentType, sessionId, filePath);
              }

              this.addMessage(agentType, 'system', `[Session: ${sessionId.substring(0, 8)}...]`);
            },
            onData: (data) => {
              // Raw PTY output - can be used for real-time feedback
              if (process.env.DEBUG) {
                const clean = stripAnsi(data);
                if (clean.trim()) {
                  console.log(`[${agentType} PTY]`, clean);
                }
              }
            },
          })
        : new CodexPtySpawner({
            cwd: process.cwd(),
            command: command.command,
            onMessage: (role, content) => {
              // Handle structured messages from session file
              if (role === 'assistant') {
                this.addMessage(agentType, 'assistant', content);
                this.updateAgentStatus(agentType, 'idle');
              } else if (role === 'system') {
                this.addMessage(agentType, 'system', content);
              }
            },
            onSessionDetected: async (sessionId, filePath) => {
              await this.updateSessionId(agentType, sessionId);

              // Link agent session to Deus session
              if (this.sessionManager && filePath) {
                await this.sessionManager.linkAgent(agentType, sessionId, filePath);
              }

              this.addMessage(agentType, 'system', `[Codex Session: ${sessionId.substring(0, 8)}...]`);
            },
            onData: (data) => {
              // Raw PTY output for real-time feedback
              if (process.env.DEBUG) {
                const clean = stripAnsi(data);
                if (clean.trim()) {
                  console.log(`[${agentType} PTY]`, clean);
                }
              }
            },
          });

      this.spawners.set(agentType, spawner);

      if (process.env.DEBUG) {
        console.log(`[Orchestrator] Spawner created for ${agentType}, starting PTY...`);
      }

      // Start the PTY
      await spawner.start();

      if (process.env.DEBUG) {
        console.log(`[Orchestrator] ${agentType} PTY started successfully, isRunning=${spawner.isRunning()}`);
      }

      // Verify the spawner is running before marking as ready
      if (!spawner.isRunning()) {
        throw new Error('PTY started but isRunning() returns false - this should not happen');
      }

      this.updateAgentStatus(agentType, 'idle', 'Ready (interactive mode)');
      this.addMessage(agentType, 'system', `✓ ${agentType === 'claude-code' ? 'Claude Code' : 'Codex'} started successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (process.env.DEBUG) {
        console.error(`[Orchestrator] Failed to start ${agentType}:`, error);
      }

      this.updateAgentStatus(agentType, 'error', 'Failed to start');
      this.addMessage(
        agentType,
        'system',
        `✗ Failed to start: ${errorMsg}`
      );

      // Don't re-throw - we've already updated the UI with the error
      // Re-throwing would crash the app
    }
  }

  // Get agent command configuration
  private getAgentCommand(
    agentType: AgentType
  ): { command: string } {
    // Check environment variables for custom commands (allows override)
    if (agentType === 'claude-code') {
      const envCommand = process.env.CLAUDE_CODE_COMMAND || process.env.CLAUDE_COMMAND;
      return { command: envCommand || 'claude' };
    } else {
      // codex - not implemented yet
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

  // Get session manager
  getSessionManager(): SessionManager | null {
    return this.sessionManager;
  }

  // Get Deus session ID
  getDeusSessionId(): string | null {
    return this.sessionManager?.getSessionId() || null;
  }
}
