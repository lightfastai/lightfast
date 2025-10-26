/**
 * Deus Configuration Management
 * Manages .deus folder in repo root for orchestration
 */

import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';

/**
 * Get .deus directory in repo root
 */
export function getDeusRootDir(repoRoot: string = process.cwd()): string {
  return path.join(repoRoot, '.deus');
}

/**
 * Get sessions directory
 */
export function getDeusSessionsDir(repoRoot: string = process.cwd()): string {
  return path.join(getDeusRootDir(repoRoot), 'sessions');
}

/**
 * Get session directory path
 */
export function getSessionDir(sessionId: string, repoRoot: string = process.cwd()): string {
  return path.join(getDeusSessionsDir(repoRoot), sessionId);
}

/**
 * Session manifest structure
 */
export interface SessionManifest {
  sessionId: string;
  jobType?: string;
  createdAt: string;
  status: 'active' | 'paused' | 'completed';
  agents: {
    claudeCode?: {
      enabled: boolean;
      sessionId?: string;
      pid?: number;
    };
    codex?: {
      enabled: boolean;
      sessionId?: string;
      pid?: number;
    };
  };
  mcpServers: string[];
  metadata: {
    cwd: string;
    branch?: string;
  };
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * MCP Configuration file format (.mcp.json)
 */
export interface MCPConfigFile {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Initialize .deus directory structure
 */
export async function initializeDeusDirectory(repoRoot: string = process.cwd()): Promise<void> {
  const deusRoot = getDeusRootDir(repoRoot);
  const sessionsDir = getDeusSessionsDir(repoRoot);
  const templatesDir = path.join(deusRoot, 'templates');

  // Create directories
  await fs.promises.mkdir(deusRoot, { recursive: true });
  await fs.promises.mkdir(sessionsDir, { recursive: true });
  await fs.promises.mkdir(templatesDir, { recursive: true });

  // Create default config if it doesn't exist
  const configPath = path.join(deusRoot, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      version: '1.0.0',
      defaultJobType: 'general',
      sessionRetentionDays: 7,
    };
    await fs.promises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
  }

  // Create default templates
  const defaultMcpsPath = path.join(templatesDir, 'default-mcps.json');
  if (!fs.existsSync(defaultMcpsPath)) {
    const defaultMcps = {
      requiredServers: ['deus-session'],
      optionalServers: ['playwright'],
    };
    await fs.promises.writeFile(defaultMcpsPath, JSON.stringify(defaultMcps, null, 2));
  }
}

/**
 * Create a new session
 */
export async function createSession(
  options: {
    jobType?: string;
    mcpServers?: string[];
    repoRoot?: string;
  } = {}
): Promise<SessionManifest> {
  const repoRoot = options.repoRoot || process.cwd();
  const sessionId = nanoid();
  const sessionDir = getSessionDir(sessionId, repoRoot);

  // Ensure .deus is initialized
  await initializeDeusDirectory(repoRoot);

  // Create session directory structure
  await fs.promises.mkdir(sessionDir, { recursive: true });
  await fs.promises.mkdir(path.join(sessionDir, 'logs'), { recursive: true });

  // Get git branch if possible
  let branch: string | undefined;
  try {
    const { execSync } = await import('node:child_process');
    branch = execSync('git branch --show-current', {
      cwd: repoRoot,
      encoding: 'utf-8'
    }).trim();
  } catch {
    // Git not available or not a git repo
  }

  // Create manifest
  const manifest: SessionManifest = {
    sessionId,
    jobType: options.jobType || 'general',
    createdAt: new Date().toISOString(),
    status: 'active',
    agents: {
      claudeCode: {
        enabled: true,
      },
      codex: {
        enabled: true,
      },
    },
    mcpServers: options.mcpServers || ['deus-session'],
    metadata: {
      cwd: repoRoot,
      branch,
    },
  };

  // Save manifest
  await saveSessionManifest(manifest, repoRoot);

  return manifest;
}

/**
 * Save session manifest
 */
export async function saveSessionManifest(
  manifest: SessionManifest,
  repoRoot: string = process.cwd()
): Promise<void> {
  const manifestPath = path.join(getSessionDir(manifest.sessionId, repoRoot), 'manifest.json');
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Load session manifest
 */
export async function loadSessionManifest(
  sessionId: string,
  repoRoot: string = process.cwd()
): Promise<SessionManifest | null> {
  const manifestPath = path.join(getSessionDir(sessionId, repoRoot), 'manifest.json');

  try {
    const content = await fs.promises.readFile(manifestPath, 'utf-8');
    return JSON.parse(content) as SessionManifest;
  } catch {
    return null;
  }
}

/**
 * Read .mcp.json file from repo root
 * Returns empty config if file doesn't exist (graceful fallback)
 */
export async function readMCPConfig(repoRoot: string = process.cwd()): Promise<MCPConfigFile> {
  const mcpConfigPath = path.join(repoRoot, '.mcp.json');

  try {
    const content = await fs.promises.readFile(mcpConfigPath, 'utf-8');
    return JSON.parse(content) as MCPConfigFile;
  } catch {
    // No .mcp.json found - return empty config (graceful fallback)
    if (process.env.DEBUG) {
      console.log('[deus-config] No .mcp.json found, using empty MCP config');
    }
    return { mcpServers: {} };
  }
}

/**
 * Generate Claude Code MCP config for a session
 * Gracefully handles missing .mcp.json by creating empty config
 */
export async function generateClaudeMCPConfig(
  sessionId: string,
  mcpServers: string[],
  repoRoot: string = process.cwd()
): Promise<MCPConfigFile> {
  const mcpConfig = await readMCPConfig(repoRoot);

  // Filter servers based on allowed list
  const filteredServers: Record<string, MCPServerConfig> = {};

  for (const serverName of mcpServers) {
    const serverConfig = mcpConfig.mcpServers[serverName];

    if (!serverConfig) {
      if (process.env.DEBUG) {
        console.log(`[deus-config] MCP server '${serverName}' not found in .mcp.json, skipping`);
      }
      continue;
    }

    // Inject session ID for deus-session server
    if (serverName === 'deus-session') {
      filteredServers[serverName] = {
        ...serverConfig,
        args: [...serverConfig.args, '--session', sessionId],
      };
    } else {
      filteredServers[serverName] = serverConfig;
    }
  }

  const claudeConfig: MCPConfigFile = {
    mcpServers: filteredServers,
  };

  // Save to session directory
  const configPath = path.join(getSessionDir(sessionId, repoRoot), 'claude.json');
  await fs.promises.writeFile(configPath, JSON.stringify(claudeConfig, null, 2));

  return claudeConfig;
}

/**
 * Generate Codex config flags for a session
 * Gracefully handles missing .mcp.json by returning empty flags
 */
export async function generateCodexConfigFlags(
  sessionId: string,
  mcpServers: string[],
  repoRoot: string = process.cwd()
): Promise<string[]> {
  const mcpConfig = await readMCPConfig(repoRoot);

  const flags: string[] = [];

  for (const serverName of mcpServers) {
    const serverConfig = mcpConfig.mcpServers[serverName];

    if (!serverConfig) {
      if (process.env.DEBUG) {
        console.log(`[deus-config] MCP server '${serverName}' not found in .mcp.json, skipping`);
      }
      continue;
    }

    // Build -c flags for each server
    const configBase = `mcp_servers.${serverName}`;

    // Command
    flags.push('-c');
    flags.push(`${configBase}.command="${serverConfig.command}"`);

    // Args (inject session ID for deus-session)
    const args = serverName === 'deus-session'
      ? [...serverConfig.args, '--session', sessionId]
      : serverConfig.args;

    flags.push('-c');
    flags.push(`${configBase}.args=${JSON.stringify(args)}`);

    // Env (if present)
    if (serverConfig.env) {
      for (const [key, value] of Object.entries(serverConfig.env)) {
        flags.push('-c');
        flags.push(`${configBase}.env.${key}="${value}"`);
      }
    }
  }

  return flags;
}

/**
 * List all active sessions
 */
export async function listActiveSessions(repoRoot: string = process.cwd()): Promise<SessionManifest[]> {
  const sessionsDir = getDeusSessionsDir(repoRoot);

  try {
    const dirs = await fs.promises.readdir(sessionsDir);
    const manifests: SessionManifest[] = [];

    for (const dir of dirs) {
      const manifest = await loadSessionManifest(dir, repoRoot);
      if (manifest && manifest.status === 'active') {
        manifests.push(manifest);
      }
    }

    return manifests.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * Clean up old sessions
 */
export async function cleanupOldSessions(
  retentionDays: number = 7,
  repoRoot: string = process.cwd()
): Promise<void> {
  const sessionsDir = getDeusSessionsDir(repoRoot);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const dirs = await fs.promises.readdir(sessionsDir);

    for (const dir of dirs) {
      const manifest = await loadSessionManifest(dir, repoRoot);

      if (manifest && manifest.status === 'completed') {
        const createdDate = new Date(manifest.createdAt);

        if (createdDate < cutoffDate) {
          const sessionDir = getSessionDir(dir, repoRoot);
          await fs.promises.rm(sessionDir, { recursive: true });
          console.log(`Cleaned up old session: ${dir}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}
