import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface Organization {
  id: string;
  slug: string;
  name: string;
}

export interface Config {
  apiKey?: string;
  defaultOrgId?: string;
  defaultOrgSlug?: string;
  organizations: Organization[];
}

const CONFIG_DIR = path.join(os.homedir(), '.deus');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Get API URL with auto-detection
 * Priority: DEUS_API_URL env var > NODE_ENV > default production
 */
export function getApiUrl(): string {
  // 1. Explicit env var (highest priority)
  if (process.env.DEUS_API_URL) {
    return process.env.DEUS_API_URL;
  }

  // 2. Auto-detect from NODE_ENV
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:4107';
  }

  // 3. Default to production
  return 'https://deus.lightfast.ai';
}

/**
 * Load config from disk
 */
export function loadConfig(): Config {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { organizations: [] };
  }
}

/**
 * Save config to disk
 */
export function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  return Boolean(loadConfig().apiKey);
}

/**
 * Set API key
 */
export function setApiKey(apiKey: string): void {
  const config = loadConfig();
  saveConfig({ ...config, apiKey });
}

/**
 * Update organizations list
 */
export function updateOrganizations(organizations: Organization[]): void {
  const config = loadConfig();
  saveConfig({ ...config, organizations });
}

/**
 * Set default organization
 */
export function setDefaultOrganization(orgId: string, orgSlug: string): void {
  const config = loadConfig();
  saveConfig({ ...config, defaultOrgId: orgId, defaultOrgSlug: orgSlug });
}

/**
 * Get default organization
 */
export function getDefaultOrganization(): { id: string; slug: string } | null {
  const config = loadConfig();
  if (config.defaultOrgId && config.defaultOrgSlug) {
    return { id: config.defaultOrgId, slug: config.defaultOrgSlug };
  }
  return null;
}

/**
 * Get config directory path
 */
export function getConfigPath(): string {
  return CONFIG_DIR;
}

/**
 * Clear all config (logout)
 */
export function clearConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch {
    // Ignore errors during cleanup
  }
}
