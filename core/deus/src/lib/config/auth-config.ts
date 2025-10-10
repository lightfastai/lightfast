/**
 * Authentication Configuration Management
 * Manages API keys and organization settings for web app integration
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Organization information
 */
export interface AuthConfigOrganization {
  id: string;
  slug: string;
  name: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  apiKey?: string;
  apiUrl: string;
  defaultOrgId?: string;
  defaultOrgSlug?: string;
  organizations: AuthConfigOrganization[];
}

/**
 * Get auth config directory path
 */
export function getAuthConfigDir(): string {
  return path.join(os.homedir(), '.deus');
}

/**
 * Get auth config file path
 */
export function getAuthConfigPath(): string {
  return path.join(getAuthConfigDir(), 'auth.json');
}

/**
 * Get default API URL (can be overridden with env var)
 */
export function getDefaultApiUrl(): string {
  return process.env.DEUS_API_URL || 'https://deus.lightfast.ai';
}

/**
 * Load authentication configuration
 * Returns config with defaults if file doesn't exist
 */
export function loadAuthConfig(): AuthConfig {
  const configPath = getAuthConfigPath();

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as AuthConfig;

    // Ensure apiUrl is set (for backwards compatibility)
    if (!config.apiUrl) {
      config.apiUrl = getDefaultApiUrl();
    }

    return config;
  } catch (error) {
    // File doesn't exist or is invalid - return default config
    return {
      apiUrl: getDefaultApiUrl(),
      organizations: [],
    };
  }
}

/**
 * Save authentication configuration
 */
export function saveAuthConfig(config: AuthConfig): void {
  const configDir = getAuthConfigDir();
  const configPath = getAuthConfigPath();

  try {
    // Ensure directory exists
    fs.mkdirSync(configDir, { recursive: true });

    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to save auth config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clear authentication configuration
 */
export function clearAuthConfig(): void {
  const configPath = getAuthConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    throw new Error(
      `Failed to clear auth config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const config = loadAuthConfig();
  return Boolean(config.apiKey);
}

/**
 * Update API key
 */
export function setApiKey(apiKey: string): void {
  const config = loadAuthConfig();
  config.apiKey = apiKey;
  saveAuthConfig(config);
}

/**
 * Update organizations list
 */
export function updateOrganizations(organizations: AuthConfigOrganization[]): void {
  const config = loadAuthConfig();
  config.organizations = organizations;
  saveAuthConfig(config);
}

/**
 * Set default organization
 */
export function setDefaultOrganization(orgId: string, orgSlug: string): void {
  const config = loadAuthConfig();
  config.defaultOrgId = orgId;
  config.defaultOrgSlug = orgSlug;
  saveAuthConfig(config);
}

/**
 * Get default organization
 */
export function getDefaultOrganization(): {
  id: string;
  slug: string;
} | null {
  const config = loadAuthConfig();
  if (config.defaultOrgId && config.defaultOrgSlug) {
    return {
      id: config.defaultOrgId,
      slug: config.defaultOrgSlug,
    };
  }
  return null;
}
