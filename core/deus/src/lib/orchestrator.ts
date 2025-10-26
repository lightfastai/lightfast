/**
 * Orchestrator - Main Deus Orchestrator (v2.0)
 *
 * USE THIS FOR:
 * - Full Deus experience with smart routing
 * - Interactive TUI mode
 * - Headless mode with Deus routing
 * - Multi-agent workflows with Deus as coordinator
 * - MCP integration and session management
 *
 * Features:
 * - Deus router decides which agent to use
 * - Sequential agent execution (one active at a time)
 * - MCP configuration and session management
 * - "back" command to return to Deus
 * - Supports both interactive and headless modes
 */

import { DeusAgent, type DeusAction, type DeusResponse } from './router.js';
import { MCPOrchestrator } from './mcp-orchestrator.js';
import type { AgentType } from '../types/index.js';
import { SessionManager } from './session/session-manager.js';
import { ClaudePtySpawner, stripAnsi } from './spawners/claude-spawner.js';
import { CodexPtySpawner } from './spawners/codex-spawner.js';
import { getSessionDir } from './config/deus-config.js';
import { isCommand, executeCommand } from './commands.js';
import { SessionSyncService } from './sync/session-sync.js';
import { loadConfig, getApiUrl, isAuthenticated } from './config/config.js';
import type { LightfastAppDeusUIMessage } from '@repo/deus-types';
import type { ApprovalPrompt } from './spawners/base-spawner.js';
import { logger } from './utils/logger.js';

export type ActiveAgent = 'deus' | 'claude-code' | 'codex';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent: ActiveAgent;
}

export interface OrchestratorState {
  activeAgent: ActiveAgent;
  messages: AgentMessage[];
  uiMessages: LightfastAppDeusUIMessage[]; // New format for Deus messages with parts
  sessionId: string | null;
  jobType: string | null;
  mcpServers: string[];
  pendingApproval: ApprovalPrompt | null; // Pending approval request from agent
}

/**
 * Orchestrator
 * Manages sequential agent execution with Deus as the router
 */
export class Orchestrator {
  private state: OrchestratorState;
  private deusAgent: DeusAgent | null = null;
  private mcpOrchestrator: MCPOrchestrator | null = null;
  private sessionManager: SessionManager | null = null;
  private syncService: SessionSyncService | null = null;
  private claudeSpawner: ClaudePtySpawner | null = null;
  private codexSpawner: CodexPtySpawner | null = null;
  private listeners: Set<(state: OrchestratorState) => void> = new Set();
  private messageIdCounter = 0;

  constructor(private repoRoot: string = process.cwd()) {
    this.state = {
      activeAgent: 'deus',
      messages: [],
      uiMessages: [],
      sessionId: null,
      jobType: null,
      mcpServers: [],
      pendingApproval: null,
    };

    // Add welcome message
    this.addMessage('deus', 'system', this.getWelcomeMessage());
  }

  /**
   * Initialize orchestrator
   */
  async initialize(): Promise<void> {
    // Initialize session manager for Deus
    this.sessionManager = new SessionManager();
    await this.sessionManager.initialize();

    this.state.sessionId = this.sessionManager.getSessionId();

    // Initialize Deus agent with session ID
    this.deusAgent = new DeusAgent(this.state.sessionId);

    // Initialize session sync service if authenticated
    if (isAuthenticated()) {
      const config = loadConfig();
      const apiUrl = getApiUrl();
      const authConfig = { ...config, apiUrl };
      this.syncService = new SessionSyncService(authConfig);

      // Sync session creation
      const sessionState = this.sessionManager.getState();
      if (sessionState) {
        try {
          await this.syncService.createSession(sessionState);
          this.syncService.startAutoSync(this.state.sessionId);

          logger.info('[Orchestrator] Session sync enabled');
        } catch (error) {
          logger.error('[Orchestrator] Failed to initialize session sync', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    console.log(`[Orchestrator] Initialized with session: ${this.state.sessionId}`);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OrchestratorState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit state changes
   */
  private emit(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Add message to state (legacy format for Claude/Codex)
   */
  private addMessage(
    agent: ActiveAgent,
    role: AgentMessage['role'],
    content: string
  ): void {
    const message: AgentMessage = {
      id: `msg-${this.messageIdCounter++}`,
      role,
      content,
      timestamp: new Date(),
      agent,
    };

    this.state = {
      ...this.state,
      messages: [...this.state.messages, message],
    };

    this.emit();

    // Sync message if sync service is enabled
    if (this.syncService && this.state.sessionId && role !== 'system') {
      this.syncService
        .syncMessage(
          this.state.sessionId,
          role,
          content,
          undefined, // modelId - not available at this level
          agent
        )
        .catch((error) => {
          logger.error('[Orchestrator] Failed to sync message', {
            error: error instanceof Error ? error.message : String(error)
          });
        });
    }
  }

  /**
   * Add UIMessage to state (new format for Deus with parts)
   */
  private addUIMessage(message: LightfastAppDeusUIMessage): void {
    this.state = {
      ...this.state,
      uiMessages: [...this.state.uiMessages, message],
    };

    this.emit();

    // TODO: Sync UIMessage to backend if needed
  }

  /**
   * Handle user message
   */
  async handleUserMessage(message: string): Promise<void> {
    // Add user message
    this.addMessage(this.state.activeAgent, 'user', message);

    // Also add to uiMessages if Deus is active (for new UI format)
    if (this.state.activeAgent === 'deus') {
      const userUIMessage: LightfastAppDeusUIMessage = {
        id: `ui-msg-${this.messageIdCounter++}`,
        role: 'user',
        parts: [{ type: 'text', text: message }],
        metadata: {
          createdAt: new Date().toISOString(),
          sessionId: this.state.sessionId || undefined,
          agentType: 'deus',
        },
      };
      this.addUIMessage(userUIMessage);
    }

    // Check if it's a command
    if (isCommand(message)) {
      await this.handleCommand(message);
      return;
    }

    // Route based on active agent
    if (this.state.activeAgent === 'deus') {
      await this.handleDeusMessage(message);
    } else if (this.state.activeAgent === 'claude-code') {
      await this.handleClaudeCodeMessage(message);
    } else if (this.state.activeAgent === 'codex') {
      await this.handleCodexMessage(message);
    }
  }

  /**
   * Handle command execution
   */
  private async handleCommand(message: string): Promise<void> {
    const result = await executeCommand(message, {
      orchestratorState: this.state,
      sessionState: this.sessionManager?.getState() || null,
    });

    // Add command result as system message
    this.addMessage(this.state.activeAgent, 'system', result.message);
  }

  /**
   * Handle message when Deus is active
   */
  private async handleDeusMessage(message: string): Promise<void> {
    // Check for handback command
    if (message.toLowerCase().trim() === 'back' || message.toLowerCase().trim() === 'return') {
      this.addMessage('deus', 'system', "I'm already active. No agent to return from.");
      return;
    }

    // Process with Deus agent
    if (!this.deusAgent) {
      this.addMessage('deus', 'system', 'Error: Deus agent not initialized');
      return;
    }

    const response = await this.deusAgent.processMessage(message);

    // Add Deus response - use new UIMessage format if available
    if (response.message) {
      this.addUIMessage(response.message);
    } else {
      // Fallback to legacy format
      this.addMessage('deus', 'assistant', response.response);
    }

    // If Deus decided to start an agent, do it
    if (response.action) {
      await this.startAgent(response.action);
    }
  }

  /**
   * Handle message when Claude Code is active
   */
  private async handleClaudeCodeMessage(message: string): Promise<void> {
    // Check for handback command
    if (message.toLowerCase().trim() === 'back' || message.toLowerCase().trim() === 'return') {
      await this.handbackToDeus();
      return;
    }

    // Forward to Claude Code
    if (this.claudeSpawner && this.claudeSpawner.isRunning()) {
      try {
        await this.claudeSpawner.write(message);
      } catch (error) {
        this.addMessage(
          'claude-code',
          'system',
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      this.addMessage('claude-code', 'system', 'Claude Code is not running. Type "back" to return to Deus.');
    }
  }

  /**
   * Handle message when Codex is active
   */
  private async handleCodexMessage(message: string): Promise<void> {
    // Check for handback command
    if (message.toLowerCase().trim() === 'back' || message.toLowerCase().trim() === 'return') {
      await this.handbackToDeus();
      return;
    }

    // Forward to Codex
    if (this.codexSpawner && this.codexSpawner.isRunning()) {
      try {
        await this.codexSpawner.write(message);
      } catch (error) {
        this.addMessage(
          'codex',
          'system',
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      this.addMessage('codex', 'system', 'Codex is not running. Type "back" to return to Deus.');
    }
  }

  /**
   * Start an agent based on Deus decision
   */
  private async startAgent(action: DeusAction): Promise<void> {
    try {
      // Only create MCP session if MCPs are requested
      if (action.config.mcpServers.length > 0) {
        this.addMessage('deus', 'system', 'Creating MCP session...');

        // Create MCP orchestrator
        this.mcpOrchestrator = new MCPOrchestrator({
          jobType: action.config.jobType,
          mcpServers: action.config.mcpServers,
          repoRoot: this.repoRoot,
        });

        await this.mcpOrchestrator.initialize();

        const manifest = this.mcpOrchestrator.getManifest();
        if (!manifest) {
          throw new Error('Failed to create MCP session');
        }

        // Update state
        this.state = {
          ...this.state,
          jobType: manifest.jobType ?? null,
          mcpServers: manifest.mcpServers,
        };

        this.addMessage('deus', 'system', `Session created: ${manifest.sessionId.substring(0, 8)}...`);
      } else {
        // No MCPs - start agent directly
        this.state = {
          ...this.state,
          jobType: action.config.jobType,
          mcpServers: [],
        };

        logger.info('[Orchestrator] Starting agent without MCP configuration');
      }

      // Start the appropriate agent
      if (action.type === 'start-claude-code') {
        await this.startClaudeCode(action.config.prompt);
      } else {
        await this.startCodex(action.config.prompt);
      }
    } catch (error) {
      this.addMessage(
        'deus',
        'system',
        `Failed to start agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Start Claude Code
   */
  private async startClaudeCode(prompt: string): Promise<void> {
    this.addMessage('deus', 'system', 'Starting Claude Code...');

    // Build command based on whether MCP session exists
    let command = 'claude';

    if (this.mcpOrchestrator) {
      const manifest = this.mcpOrchestrator.getManifest();
      if (manifest) {
        const sessionId = manifest.sessionId;
        const sessionDir = getSessionDir(sessionId, this.repoRoot);
        command = `claude --session-id ${sessionId} --mcp-config ${sessionDir}/claude.json --strict-mcp-config`;
      }
    }

    // Create PTY spawner for Claude Code
    this.claudeSpawner = new ClaudePtySpawner({
      cwd: this.repoRoot,
      command,
      onMessage: (role, content) => {
        this.addMessage('claude-code', role === 'user' ? 'user' : 'assistant', content);
      },
      onSessionDetected: async (claudeSessionId, filePath) => {
        if (this.sessionManager && filePath) {
          await this.sessionManager.linkAgent('claude-code', claudeSessionId, filePath);
        }
        this.addMessage('claude-code', 'system', `Session: ${claudeSessionId.substring(0, 8)}...`);
      },
      onData: (data) => {
        const clean = stripAnsi(data);
        if (clean.trim()) {
          logger.debug('[Claude Code PTY]', { data: clean });
        }
      },
      onApprovalRequest: (approval) => {
        logger.info('[Orchestrator] Approval request received', { prompt: approval.prompt });

        // Add system message to show approval is needed
        this.addMessage('claude-code', 'system', `⚠️  Approval required - Press 'y' to approve or 'n' to reject`);

        // Update state with pending approval
        this.state = {
          ...this.state,
          pendingApproval: approval,
        };
        this.emit();
      },
    });

    // Start PTY
    await this.claudeSpawner.start();

    // Switch to Claude Code
    this.state = {
      ...this.state,
      activeAgent: 'claude-code',
    };
    this.emit();

    // Sync status update
    if (this.syncService && this.state.sessionId) {
      this.syncService
        .updateStatus(this.state.sessionId, 'active', 'claude-code')
        .catch((error) => {
          logger.error('[Orchestrator] Failed to sync status', { error });
        });
    }

    this.addMessage('claude-code', 'system', '✓ Claude Code started. Type "back" to return to Deus.');

    // Send initial prompt if provided
    if (prompt && prompt.trim()) {
      setTimeout(async () => {
        try {
          await this.claudeSpawner?.write(prompt);
        } catch (error) {
          console.error('[Orchestrator] Error sending initial prompt:', error);
        }
      }, 1000); // Wait a bit for Claude Code to be ready
    }
  }

  /**
   * Start Codex
   */
  private async startCodex(prompt: string): Promise<void> {
    this.addMessage('deus', 'system', 'Starting Codex...');

    // Build command based on whether MCP session exists
    let command = 'codex';

    // Note: For Codex, MCP config would be injected via -c flags
    // This would require spawning with the flags from MCPOrchestrator
    // For now, we start basic Codex without MCP injection

    if (!this.mcpOrchestrator) {
      logger.info('[Orchestrator] Starting Codex without MCP configuration');
    }

    // Create PTY spawner for Codex
    this.codexSpawner = new CodexPtySpawner({
      cwd: this.repoRoot,
      command,
      onMessage: (role, content) => {
        this.addMessage('codex', role === 'user' ? 'user' : 'assistant', content);
      },
      onSessionDetected: async (codexSessionId, filePath) => {
        if (this.sessionManager && filePath) {
          await this.sessionManager.linkAgent('codex', codexSessionId, filePath);
        }
        this.addMessage('codex', 'system', `Session: ${codexSessionId.substring(0, 8)}...`);
      },
      onData: (data) => {
        const clean = stripAnsi(data);
        if (clean.trim()) {
          logger.debug('[Codex PTY]', { data: clean });
        }
      },
    });

    // Start PTY
    await this.codexSpawner.start();

    // Switch to Codex
    this.state = {
      ...this.state,
      activeAgent: 'codex',
    };
    this.emit();

    // Sync status update
    if (this.syncService && this.state.sessionId) {
      this.syncService
        .updateStatus(this.state.sessionId, 'active', 'codex')
        .catch((error) => {
          logger.error('[Orchestrator] Failed to sync status', { error });
        });
    }

    this.addMessage('codex', 'system', '✓ Codex started. Type "back" to return to Deus.');

    // Send initial prompt if provided
    if (prompt && prompt.trim()) {
      setTimeout(async () => {
        try {
          await this.codexSpawner?.write(prompt);
        } catch (error) {
          console.error('[Orchestrator] Error sending initial prompt:', error);
        }
      }, 1000);
    }
  }

  /**
   * Hand back to Deus from current agent
   */
  async handbackToDeus(): Promise<void> {
    const previousAgent = this.state.activeAgent;

    if (previousAgent === 'deus') {
      this.addMessage('deus', 'system', "I'm already active.");
      return;
    }

    this.addMessage(previousAgent, 'system', 'Returning to Deus...');

    // Stop current agent
    if (previousAgent === 'claude-code' && this.claudeSpawner) {
      this.claudeSpawner.cleanup();
      this.claudeSpawner = null;
    } else if (previousAgent === 'codex' && this.codexSpawner) {
      this.codexSpawner.cleanup();
      this.codexSpawner = null;
    }

    // Complete MCP session
    if (this.mcpOrchestrator) {
      await this.mcpOrchestrator.completeSession();
      this.mcpOrchestrator = null;
    }

    // Switch back to Deus
    this.state = {
      ...this.state,
      activeAgent: 'deus',
      jobType: null,
      mcpServers: [],
    };
    this.emit();

    // Sync status update
    if (this.syncService && this.state.sessionId) {
      this.syncService
        .updateStatus(this.state.sessionId, 'active', 'deus')
        .catch((error) => {
          logger.error('[Orchestrator] Failed to sync status', { error });
        });
    }

    this.addMessage('deus', 'system', `✓ Task completed. ${previousAgent} stopped. What's next?`);
    this.deusAgent?.addSystemMessage(`Completed ${previousAgent} task. Ready for next task.`);
  }

  /**
   * Manually switch agents (for debugging)
   */
  async switchToAgent(agent: ActiveAgent): Promise<void> {
    if (agent === this.state.activeAgent) {
      this.addMessage(agent, 'system', `Already active on ${agent}`);
      return;
    }

    // Can only switch between active spawned agents and Deus
    if (agent === 'deus') {
      await this.handbackToDeus();
    } else if (agent === 'claude-code' && this.claudeSpawner?.isRunning()) {
      this.state = { ...this.state, activeAgent: agent };
      this.emit();
      this.addMessage(agent, 'system', 'Switched to Claude Code');
    } else if (agent === 'codex' && this.codexSpawner?.isRunning()) {
      this.state = { ...this.state, activeAgent: agent };
      this.emit();
      this.addMessage(agent, 'system', 'Switched to Codex');
    } else {
      this.addMessage(
        this.state.activeAgent,
        'system',
        `Cannot switch to ${agent} - not running. Type "back" to return to Deus.`
      );
    }
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Get messages for current agent
   */
  getMessagesForAgent(agent: ActiveAgent): AgentMessage[] {
    return this.state.messages.filter(m => m.agent === agent);
  }

  /**
   * Get all messages
   */
  getAllMessages(): AgentMessage[] {
    return this.state.messages;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    // Stop all spawners
    if (this.claudeSpawner) {
      this.claudeSpawner.cleanup();
      this.claudeSpawner = null;
    }

    if (this.codexSpawner) {
      this.codexSpawner.cleanup();
      this.codexSpawner = null;
    }

    // Complete MCP session
    if (this.mcpOrchestrator) {
      await this.mcpOrchestrator.completeSession();
      this.mcpOrchestrator = null;
    }

    // Stop session sync
    if (this.syncService) {
      this.syncService.stopAutoSync();
      this.syncService = null;
    }
  }

  /**
   * Handle approval response from user
   */
  async handleApprovalResponse(approved: boolean): Promise<void> {
    if (!this.state.pendingApproval) {
      logger.debug('[Orchestrator] No pending approval to respond to');
      return;
    }

    logger.info('[Orchestrator] Handling approval response', { approved });

    // Send response to appropriate agent
    if (this.state.activeAgent === 'claude-code' && this.claudeSpawner) {
      this.claudeSpawner.sendApproval(approved);
      this.addMessage(
        'claude-code',
        'system',
        approved ? '✓ Approved' : '✗ Rejected'
      );
    } else if (this.state.activeAgent === 'codex' && this.codexSpawner) {
      // Codex approval handling would go here
      // For now, just log
      logger.warn('[Orchestrator] Codex approval not implemented yet');
    }

    // Clear pending approval
    this.state = {
      ...this.state,
      pendingApproval: null,
    };
    this.emit();
  }

  /**
   * Get welcome message
   */
  private getWelcomeMessage(): string {
    return [
      "I'm Deus - I route your tasks to the right agent.",
      '',
      'Tell me what you need help with:',
      '• "Review the authentication code"',
      '• "Help me write tests for the API"',
      '• "start code-review"',
      '',
      'Commands:',
      '• /help - Show available commands',
      '• /status - View session information',
      '',
      'Type /help for more info.',
    ].join('\n');
  }
}
