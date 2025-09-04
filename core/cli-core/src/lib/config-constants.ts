/**
 * Configuration constants for the Lightfast CLI
 * Centralized place for all default URLs and configuration values
 */

/**
 * Default base URL for the Lightfast cloud platform
 * Can be overridden via environment variable or CLI options
 */
export const DEFAULT_BASE_URL = 'https://cloud.lightfast.ai';

/**
 * Environment variable to override the default base URL
 * Usage: LIGHTFAST_BASE_URL=https://localhost:3000 lightfast auth login
 */
export const BASE_URL_ENV_VAR = 'LIGHTFAST_BASE_URL';

/**
 * Get the base URL from environment or use default
 */
export function getBaseUrl(): string {
  return process.env[BASE_URL_ENV_VAR] || DEFAULT_BASE_URL;
}

/**
 * Build API endpoint URL
 */
export function getApiUrl(path: string = ''): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
}

/**
 * Build dashboard URL
 */
export function getDashboardUrl(path: string = ''): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
}

/**
 * Configuration file paths
 */
export const CONFIG_DIR = '.lightfast';
export const CONFIG_FILE = 'config.json';
export const KEYTAR_SERVICE = 'lightfast-cli';

/**
 * Default profile name
 */
export const DEFAULT_PROFILE = 'default';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  VALIDATE_API_KEY: '/api/trpc/apiKey.validate',
  WHOAMI: '/api/trpc/user.getUser',
  HEALTH: '/api/health',
} as const;