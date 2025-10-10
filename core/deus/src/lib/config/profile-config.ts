/**
 * Profile Configuration Management
 * Uses `conf` library for better config management with atomic writes
 */

import Conf from 'conf';

/**
 * Organization information
 */
export interface ProfileOrganization {
  id: string;
  slug: string;
  name: string;
}

/**
 * Profile configuration
 */
export interface ProfileConfig {
  apiKey?: string;
  apiUrl: string;
  defaultOrgId?: string;
  defaultOrgSlug?: string;
  organizations: ProfileOrganization[];
}

/**
 * Deus configuration with multiple profiles
 */
export interface DeusConfig {
  version: number;
  activeProfile: string; // 'default', 'dev', 'prod', etc.
  profiles: {
    [profileName: string]: ProfileConfig;
  };
}

/**
 * Configuration schema for validation
 */
const schema = {
  version: {
    type: 'number',
    default: 1,
  },
  activeProfile: {
    type: 'string',
    default: 'default',
  },
  profiles: {
    type: 'object',
    default: {},
  },
} as const;

/**
 * Get default API URL (can be overridden with env var)
 */
export function getDefaultApiUrl(): string {
  return process.env.DEUS_API_URL || 'https://deus.lightfast.ai';
}

/**
 * Config instance (singleton)
 */
let configInstance: Conf<DeusConfig> | null = null;

/**
 * Get or create config instance
 */
function getConfig(): Conf<DeusConfig> {
  if (!configInstance) {
    configInstance = new Conf<DeusConfig>({
      projectName: 'deus',
      schema: schema as any,
      defaults: {
        version: 1,
        activeProfile: 'default',
        profiles: {
          default: {
            apiUrl: getDefaultApiUrl(),
            organizations: [],
          },
        },
      },
    });
  }

  return configInstance;
}

/**
 * Get active profile name
 */
export function getActiveProfileName(): string {
  const config = getConfig();
  return config.get('activeProfile', 'default');
}

/**
 * Get active profile configuration
 */
export function getActiveProfile(): ProfileConfig {
  const config = getConfig();
  const activeProfileName = getActiveProfileName();
  const profile = config.get(`profiles.${activeProfileName}` as any);

  if (!profile) {
    // Return default empty profile
    return {
      apiUrl: getDefaultApiUrl(),
      organizations: [],
    };
  }

  return profile;
}

/**
 * Set active profile
 */
export function setActiveProfile(profileName: string): void {
  const config = getConfig();

  // Check if profile exists
  const profile = config.get(`profiles.${profileName}` as any);
  if (!profile) {
    throw new Error(`Profile '${profileName}' does not exist`);
  }

  config.set('activeProfile', profileName);
}

/**
 * List all profile names
 */
export function listProfiles(): string[] {
  const config = getConfig();
  const profiles = config.get('profiles', {});
  return Object.keys(profiles);
}

/**
 * Create a new profile
 */
export function createProfile(name: string, profileConfig?: Partial<ProfileConfig>): void {
  const config = getConfig();

  // Check if profile already exists
  const existingProfile = config.get(`profiles.${name}` as any);
  if (existingProfile) {
    throw new Error(`Profile '${name}' already exists`);
  }

  // Create new profile with defaults
  const newProfile: ProfileConfig = {
    apiUrl: profileConfig?.apiUrl || getDefaultApiUrl(),
    apiKey: profileConfig?.apiKey,
    defaultOrgId: profileConfig?.defaultOrgId,
    defaultOrgSlug: profileConfig?.defaultOrgSlug,
    organizations: profileConfig?.organizations || [],
  };

  config.set(`profiles.${name}` as any, newProfile);
}

/**
 * Delete a profile
 */
export function deleteProfile(name: string): void {
  const config = getConfig();

  // Can't delete active profile
  if (name === getActiveProfileName()) {
    throw new Error(`Cannot delete active profile '${name}'. Switch to another profile first.`);
  }

  // Check if profile exists
  const profile = config.get(`profiles.${name}` as any);
  if (!profile) {
    throw new Error(`Profile '${name}' does not exist`);
  }

  // Delete profile
  config.delete(`profiles.${name}` as any);
}

/**
 * Get a specific profile
 */
export function getProfile(name: string): ProfileConfig | null {
  const config = getConfig();
  const profile = config.get(`profiles.${name}` as any);
  return profile || null;
}

/**
 * Update a profile
 */
export function updateProfile(name: string, updates: Partial<ProfileConfig>): void {
  const config = getConfig();

  // Get existing profile
  const existingProfile = config.get(`profiles.${name}` as any);
  if (!existingProfile) {
    throw new Error(`Profile '${name}' does not exist`);
  }

  // Merge updates
  const updatedProfile: ProfileConfig = {
    ...existingProfile,
    ...updates,
  };

  config.set(`profiles.${name}` as any, updatedProfile);
}

/**
 * Check if user is authenticated (active profile has API key)
 */
export function isAuthenticated(): boolean {
  const profile = getActiveProfile();
  return Boolean(profile.apiKey);
}

/**
 * Set API key for active profile
 */
export function setApiKey(apiKey: string): void {
  const profileName = getActiveProfileName();
  const profile = getActiveProfile();

  updateProfile(profileName, {
    ...profile,
    apiKey,
  });
}

/**
 * Update organizations for active profile
 */
export function updateOrganizations(organizations: ProfileOrganization[]): void {
  const profileName = getActiveProfileName();
  const profile = getActiveProfile();

  updateProfile(profileName, {
    ...profile,
    organizations,
  });
}

/**
 * Set default organization for active profile
 */
export function setDefaultOrganization(orgId: string, orgSlug: string): void {
  const profileName = getActiveProfileName();
  const profile = getActiveProfile();

  updateProfile(profileName, {
    ...profile,
    defaultOrgId: orgId,
    defaultOrgSlug: orgSlug,
  });
}

/**
 * Get default organization for active profile
 */
export function getDefaultOrganization(): { id: string; slug: string } | null {
  const profile = getActiveProfile();

  if (profile.defaultOrgId && profile.defaultOrgSlug) {
    return {
      id: profile.defaultOrgId,
      slug: profile.defaultOrgSlug,
    };
  }

  return null;
}

/**
 * Clear authentication for active profile
 */
export function clearAuthentication(): void {
  const profileName = getActiveProfileName();
  const profile = getActiveProfile();

  updateProfile(profileName, {
    ...profile,
    apiKey: undefined,
    defaultOrgId: undefined,
    defaultOrgSlug: undefined,
    organizations: [],
  });
}

/**
 * Clear all profiles and reset to defaults
 */
export function clearAllProfiles(): void {
  const config = getConfig();
  config.clear();
}

/**
 * Get config file path (for debugging)
 */
export function getConfigPath(): string {
  const config = getConfig();
  return config.path;
}

/**
 * Export type for backwards compatibility
 */
export type AuthConfig = ProfileConfig;
export type AuthConfigOrganization = ProfileOrganization;

/**
 * Load auth config (backwards compatibility - returns active profile)
 */
export function loadAuthConfig(): AuthConfig {
  return getActiveProfile();
}

/**
 * Save auth config (backwards compatibility - updates active profile)
 */
export function saveAuthConfig(config: AuthConfig): void {
  const profileName = getActiveProfileName();
  updateProfile(profileName, config);
}

/**
 * Clear auth config (backwards compatibility)
 */
export function clearAuthConfig(): void {
  clearAuthentication();
}
