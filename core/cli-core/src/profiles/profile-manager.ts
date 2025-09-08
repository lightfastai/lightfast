import Conf from 'conf';
import { homedir } from 'os';
import { join } from 'path';
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_PROFILE, DEFAULT_ENDPOINT } from './constants.js';
import type { Profile, Config, AuthData } from './types.js';

const CONFIG_DIR_PATH = join(homedir(), CONFIG_DIR);
const CONFIG_FILE_PATH = join(CONFIG_DIR_PATH, CONFIG_FILE);
const AUTH_FILE = 'auth.json';
const AUTH_FILE_PATH = join(CONFIG_DIR_PATH, AUTH_FILE);

export class ProfileManager {
  private config: Conf<Config>;
  private auth: Conf<AuthData>;

  constructor() {
    this.config = new Conf({
      projectName: 'lightfast-cli',
      configName: 'config',
      defaults: {
        defaultProfile: DEFAULT_PROFILE,
        profiles: {}
      }
    });

    this.auth = new Conf({
      projectName: 'lightfast-cli',
      configName: 'auth',
      defaults: {
        tokens: {}
      },
      serialize: value => JSON.stringify(value, null, 2),
      accessPropertiesByDotNotation: false,
      configFileMode: 0o600 // Read/write for owner only
    });
  }

  /**
   * Get a profile by name (or default profile if no name provided)
   */
  async getProfile(name?: string): Promise<Profile | null> {
    const profileName = name || this.config.get('defaultProfile');
    return this.config.get(`profiles.${profileName}`) || null;
  }

  /**
   * Set/update a profile
   */
  async setProfile(name: string, profile: Partial<Profile>): Promise<void> {
    const now = new Date().toISOString();
    const existingProfile = this.config.get(`profiles.${name}`);
    
    this.config.set(`profiles.${name}`, {
      ...existingProfile,
      ...profile,
      name,
      endpoint: profile.endpoint || DEFAULT_ENDPOINT,
      updatedAt: now,
      createdAt: existingProfile?.createdAt || now
    });
  }

  /**
   * Remove a profile and its API key
   */
  async removeProfile(name: string): Promise<void> {
    if (!this.config.has(`profiles.${name}`)) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    // Remove API key from auth file
    if (this.auth.has(`tokens.${name}`)) {
      this.auth.delete(`tokens.${name}`);
    }

    // Remove profile from config
    this.config.delete(`profiles.${name}`);

    // If this was the default profile, reset to another profile or empty
    if (this.config.get('defaultProfile') === name) {
      const profiles = this.config.get('profiles');
      const remainingProfiles = Object.keys(profiles);
      this.config.set('defaultProfile', remainingProfiles.length > 0 ? remainingProfiles[0]! : DEFAULT_PROFILE);
    }
  }

  /**
   * List all profile names
   */
  async listProfiles(): Promise<string[]> {
    const profiles = this.config.get('profiles');
    return Object.keys(profiles);
  }

  /**
   * Get the default profile name
   */
  async getDefaultProfile(): Promise<string> {
    return this.config.get('defaultProfile');
  }

  /**
   * Set the default profile
   */
  async setDefaultProfile(name: string): Promise<void> {
    if (!this.config.has(`profiles.${name}`)) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    this.config.set('defaultProfile', name);
  }

  /**
   * Store an API key (Vercel-style: in separate auth.json with chmod 600)
   */
  async setApiKey(profileName: string, apiKey: string, apiVersion?: string): Promise<void> {
    // Store in auth file (like Vercel's ~/.vercel/auth.json)
    this.auth.set(`tokens.${profileName}`, apiKey);
    
    // Ensure profile exists with required apiVersion
    if (!this.config.has(`profiles.${profileName}`)) {
      if (!apiVersion) {
        throw new Error(`API version is required when creating profile '${profileName}'`);
      }
      this.config.set(`profiles.${profileName}`, { 
        name: profileName, 
        apiVersion: apiVersion,
        endpoint: DEFAULT_ENDPOINT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Retrieve an API key (first check env var, then auth file)
   */
  async getApiKey(profileName: string): Promise<string | null> {
    // Check environment variable first (like Vercel CLI)
    const envKey = process.env.LIGHTFAST_API_KEY || process.env.LIGHTFAST_TOKEN;
    if (envKey) {
      return envKey;
    }

    return this.auth.get(`tokens.${profileName}`) || null;
  }

  /**
   * Get the API version for a profile
   */
  async getApiVersion(profileName: string): Promise<string> {
    const profile = await this.getProfile(profileName);
    if (!profile?.apiVersion) {
      throw new Error(`Profile '${profileName}' does not have an API version configured`);
    }
    return profile.apiVersion;
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(profileName: string): Promise<void> {
    if (this.auth.has(`tokens.${profileName}`)) {
      this.auth.delete(`tokens.${profileName}`);
    }
  }

  /**
   * Check if keychain is available (always returns false now)
   */
  async isKeychainAvailable(): Promise<boolean> {
    // We're not using keychain anymore, following Vercel's approach
    return false;
  }

  /**
   * Get the config file path for debugging
   */
  getConfigPath(): string {
    return CONFIG_FILE_PATH;
  }

  /**
   * Get the auth file path for debugging
   */
  getAuthPath(): string {
    return AUTH_FILE_PATH;
  }

  /**
   * Get the full configuration object (for debugging)
   */
  async getFullConfig(): Promise<Config> {
    return { ...this.config.store };
  }

  /**
   * Clear all configuration and API keys
   */
  async clear(): Promise<void> {
    // Clear auth data
    this.auth.clear();

    // Reset config
    this.config.clear();
    this.config.set('defaultProfile', DEFAULT_PROFILE);
    this.config.set('profiles', {});
  }
}

// Export singleton instance
export const profileManager = new ProfileManager();