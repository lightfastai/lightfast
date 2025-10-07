/**
 * MCP Configuration Orchestrator
 *
 * Specialized utility for managing MCP (Model Context Protocol) sessions.
 * Used internally by SimpleOrchestrator when MCP servers are requested.
 *
 * Responsibilities:
 * - Creates .deus/sessions/{id}/ directories
 * - Generates MCP config files for Claude Code (JSON) and Codex (CLI flags)
 * - Spawns agent processes with MCP configuration injected
 * - Manages session lifecycle and cleanup
 *
 * Note: Most users should use SimpleOrchestrator instead, which handles
 * MCP configuration automatically. This class is for advanced use cases.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { AgentType } from '../types/index.js';
import {
  createSession,
  generateClaudeMCPConfig,
  generateCodexConfigFlags,
  loadSessionManifest,
  saveSessionManifest,
  getSessionDir,
  type SessionManifest,
} from './config/deus-config.js';

export interface MCPOrchestratorOptions {
  repoRoot?: string;
  jobType?: string;
  mcpServers?: string[];
  enableClaudeCode?: boolean;
  enableCodex?: boolean;
}

export interface AgentProcess {
  type: AgentType;
  process: ChildProcess;
  sessionId: string;
}

/**
 * MCP Configuration Orchestrator
 * Coordinates Claude Code and Codex agents with dynamic MCP injection
 */
export class MCPOrchestrator {
  private manifest: SessionManifest | null = null;
  private agents: Map<AgentType, AgentProcess> = new Map();
  private repoRoot: string;

  constructor(private options: MCPOrchestratorOptions = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
  }

  /**
   * Initialize a new orchestration session
   */
  async initialize(): Promise<SessionManifest> {
    console.log('[Deus MCP] Creating new orchestration session...');

    // Create session
    this.manifest = await createSession({
      jobType: this.options.jobType,
      mcpServers: this.options.mcpServers || ['deus-session'],
      repoRoot: this.repoRoot,
    });

    console.log(`[Deus MCP] Session created: ${this.manifest.sessionId}`);

    // Generate MCP configs
    await this.generateConfigs();

    return this.manifest;
  }

  /**
   * Load an existing session
   */
  async loadSession(sessionId: string): Promise<SessionManifest> {
    const manifest = await loadSessionManifest(sessionId, this.repoRoot);

    if (!manifest) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.manifest = manifest;
    console.log(`[Deus MCP] Loaded session: ${sessionId}`);

    return manifest;
  }

  /**
   * Generate MCP configs for all agents
   */
  private async generateConfigs(): Promise<void> {
    if (!this.manifest) {
      throw new Error('No session initialized');
    }

    const { sessionId, mcpServers } = this.manifest;

    // Generate Claude Code config
    console.log('[Deus MCP] Generating Claude Code MCP config...');
    await generateClaudeMCPConfig(sessionId, mcpServers, this.repoRoot);

    // Generate Codex config flags (for reference)
    console.log('[Deus MCP] Generating Codex config flags...');
    const codexFlags = await generateCodexConfigFlags(sessionId, mcpServers, this.repoRoot);

    // Save codex flags to a file for easy reference
    const fs = await import('node:fs');
    const path = await import('node:path');
    const codexFlagsPath = path.join(
      getSessionDir(sessionId, this.repoRoot),
      'codex-flags.txt'
    );
    await fs.promises.writeFile(codexFlagsPath, codexFlags.join(' \\\n  '));

    console.log('[Deus MCP] MCP configs generated successfully');
  }

  /**
   * Start Claude Code agent
   */
  async startClaudeCode(prompt?: string): Promise<AgentProcess> {
    if (!this.manifest) {
      throw new Error('No session initialized');
    }

    const { sessionId } = this.manifest;
    const sessionDir = getSessionDir(sessionId, this.repoRoot);
    const claudeConfigPath = `${sessionDir}/claude.json`;

    // Build command arguments
    const args = [
      '--session-id', sessionId,
      '--mcp-config', claudeConfigPath,
      '--strict-mcp-config',
    ];

    if (prompt) {
      args.push(prompt);
    }

    console.log('[Deus MCP] Starting Claude Code agent...');
    console.log(`[Deus MCP] Command: claude ${args.join(' ')}`);

    // Spawn Claude Code process
    const childProcess = spawn('claude', args, {
      cwd: this.repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        DEUS_SESSION_ID: sessionId,
      },
    });

    const agentProcess: AgentProcess = {
      type: 'claude-code',
      process: childProcess,
      sessionId,
    };

    this.agents.set('claude-code', agentProcess);

    // Update manifest
    this.manifest.agents.claudeCode = {
      enabled: true,
      sessionId,
      pid: process.pid,
    };
    await saveSessionManifest(this.manifest, this.repoRoot);

    // Handle process events
    process.on('exit', (code) => {
      console.log(`[Deus MCP] Claude Code exited with code ${code}`);
      this.agents.delete('claude-code');
    });

    process.on('error', (error) => {
      console.error('[Deus MCP] Claude Code error:', error);
    });

    return agentProcess;
  }

  /**
   * Start Codex agent
   */
  async startCodex(prompt?: string): Promise<AgentProcess> {
    if (!this.manifest) {
      throw new Error('No session initialized');
    }

    const { sessionId, mcpServers } = this.manifest;

    // Generate Codex config flags
    const configFlags = await generateCodexConfigFlags(sessionId, mcpServers, this.repoRoot);

    // Build command arguments
    const args = [...configFlags];

    if (prompt) {
      args.push(prompt);
    }

    console.log('[Deus MCP] Starting Codex agent...');
    console.log(`[Deus MCP] Command: codex ${args.join(' ')}`);

    // Spawn Codex process
    const childProcess = spawn('codex', args, {
      cwd: this.repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        DEUS_SESSION_ID: sessionId,
      },
    });

    const agentProcess: AgentProcess = {
      type: 'codex',
      process: childProcess,
      sessionId,
    };

    this.agents.set('codex', agentProcess);

    // Update manifest
    this.manifest.agents.codex = {
      enabled: true,
      sessionId,
      pid: process.pid,
    };
    await saveSessionManifest(this.manifest, this.repoRoot);

    // Handle process events
    process.on('exit', (code) => {
      console.log(`[Deus MCP] Codex exited with code ${code}`);
      this.agents.delete('codex');
    });

    process.on('error', (error) => {
      console.error('[Deus MCP] Codex error:', error);
    });

    return agentProcess;
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentType: AgentType): Promise<void> {
    const agent = this.agents.get(agentType);

    if (!agent) {
      console.warn(`[Deus MCP] Agent ${agentType} is not running`);
      return;
    }

    console.log(`[Deus MCP] Stopping ${agentType} agent...`);
    agent.process.kill();
    this.agents.delete(agentType);

    // Update manifest
    if (this.manifest) {
      if (agentType === 'claude-code') {
        this.manifest.agents.claudeCode = { enabled: false };
      } else {
        this.manifest.agents.codex = { enabled: false };
      }
      await saveSessionManifest(this.manifest, this.repoRoot);
    }
  }

  /**
   * Stop all agents
   */
  async stopAllAgents(): Promise<void> {
    console.log('[Deus MCP] Stopping all agents...');

    for (const [agentType] of this.agents) {
      await this.stopAgent(agentType);
    }
  }

  /**
   * Complete the session
   */
  async completeSession(): Promise<void> {
    if (!this.manifest) {
      throw new Error('No session initialized');
    }

    console.log('[Deus MCP] Completing session...');

    // Stop all agents
    await this.stopAllAgents();

    // Update manifest
    this.manifest.status = 'completed';
    await saveSessionManifest(this.manifest, this.repoRoot);

    console.log(`[Deus MCP] Session ${this.manifest.sessionId} completed`);
  }

  /**
   * Get the current session manifest
   */
  getManifest(): SessionManifest | null {
    return this.manifest;
  }

  /**
   * Get running agents
   */
  getRunningAgents(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Print session info
   */
  printSessionInfo(): void {
    if (!this.manifest) {
      console.log('[Deus MCP] No active session');
      return;
    }

    console.log('\n=== Deus MCP Session Info ===');
    console.log(`Session ID: ${this.manifest.sessionId}`);
    console.log(`Job Type: ${this.manifest.jobType}`);
    console.log(`Status: ${this.manifest.status}`);
    console.log(`Created: ${this.manifest.createdAt}`);
    console.log(`\nMCP Servers: ${this.manifest.mcpServers.join(', ')}`);
    console.log(`\nAgents:`);
    console.log(`  Claude Code: ${this.manifest.agents.claudeCode?.enabled ? '✓' : '✗'}`);
    console.log(`  Codex: ${this.manifest.agents.codex?.enabled ? '✓' : '✗'}`);

    const sessionDir = getSessionDir(this.manifest.sessionId, this.repoRoot);
    console.log(`\nSession Directory: ${sessionDir}`);
    console.log('============================\n');
  }

  /**
   * Get command to manually start Claude Code with this session
   */
  getClaudeCodeCommand(): string {
    if (!this.manifest) {
      throw new Error('No session initialized');
    }

    const { sessionId } = this.manifest;
    const sessionDir = getSessionDir(sessionId, this.repoRoot);
    const claudeConfigPath = `${sessionDir}/claude.json`;

    return `claude --session-id ${sessionId} --mcp-config ${claudeConfigPath} --strict-mcp-config`;
  }

  /**
   * Get command to manually start Codex with this session
   */
  async getCodexCommand(): Promise<string> {
    if (!this.manifest) {
      throw new Error('No session initialized');
    }

    const { sessionId, mcpServers } = this.manifest;
    const configFlags = await generateCodexConfigFlags(sessionId, mcpServers, this.repoRoot);

    return `codex ${configFlags.join(' ')}`;
  }
}

/**
 * Quick start helper - creates and initializes an MCP orchestrator
 */
export async function createMCPOrchestrator(
  options: MCPOrchestratorOptions = {}
): Promise<MCPOrchestrator> {
  const orchestrator = new MCPOrchestrator(options);
  await orchestrator.initialize();
  return orchestrator;
}

/**
 * Load existing session helper
 */
export async function loadMCPOrchestrator(
  sessionId: string,
  repoRoot?: string
): Promise<MCPOrchestrator> {
  const orchestrator = new MCPOrchestrator({ repoRoot });
  await orchestrator.loadSession(sessionId);
  return orchestrator;
}
