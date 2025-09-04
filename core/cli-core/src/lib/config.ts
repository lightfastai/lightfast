import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_PROFILE } from './config-constants.js';

const CONFIG_DIR_PATH = join(homedir(), CONFIG_DIR);
const CONFIG_FILE_PATH = join(CONFIG_DIR_PATH, CONFIG_FILE);
const AUTH_FILE = 'auth.json';
const AUTH_FILE_PATH = join(CONFIG_DIR_PATH, AUTH_FILE);

export interface Profile {
  name: string;
  endpoint?: string;
  userId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Config {
  defaultProfile: string;
  profiles: Record<string, Profile>;
}

export interface AuthData {
  tokens: Record<string, string>; // profileName -> token
}

export class ConfigStore {
  private config: Config | null = null;
  private authData: AuthData | null = null;

  /**
   * Initialize the config store and ensure the config directory exists
   */
  private async init(): Promise<void> {
    if (this.config !== null && this.authData !== null) return;

    try {
      await fs.mkdir(CONFIG_DIR_PATH, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create config directory: ${error}`);
    }

    await this.loadConfig();
    await this.loadAuth();
  }

  /**
   * Load configuration from disk
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(CONFIG_FILE_PATH, 'utf8');
      this.config = JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config file doesn't exist, create default
        this.config = {
          defaultProfile: DEFAULT_PROFILE,
          profiles: {}
        };
      } else {
        throw new Error(`Failed to load config: ${error.message}`);
      }
    }
  }

  /**
   * Load auth data from disk
   */
  private async loadAuth(): Promise<void> {
    try {
      const data = await fs.readFile(AUTH_FILE_PATH, 'utf8');
      this.authData = JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Auth file doesn't exist, create default
        this.authData = {
          tokens: {}
        };
      } else {
        throw new Error(`Failed to load auth: ${error.message}`);
      }
    }
  }

  /**
   * Save configuration to disk
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('Config not initialized');
    }

    try {
      await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  /**
   * Save auth data to disk with restricted permissions (like Vercel CLI)
   */
  private async saveAuth(): Promise<void> {
    if (!this.authData) {
      throw new Error('Auth not initialized');
    }

    try {
      // Write the file
      await fs.writeFile(AUTH_FILE_PATH, JSON.stringify(this.authData, null, 2), {
        encoding: 'utf8',
        mode: 0o600 // Read/write for owner only (chmod 600)
      });

      // Double-check permissions on existing file
      await fs.chmod(AUTH_FILE_PATH, 0o600);
    } catch (error) {
      throw new Error(`Failed to save auth: ${error}`);
    }
  }

  /**
   * Get a profile by name (or default profile if no name provided)
   */
  async getProfile(name?: string): Promise<Profile | null> {
    await this.init();
    const profileName = name || this.config!.defaultProfile;
    return this.config!.profiles[profileName] || null;
  }

  /**
   * Set/update a profile
   */
  async setProfile(name: string, profile: Partial<Profile>): Promise<void> {
    await this.init();
    
    const now = new Date().toISOString();
    const existingProfile = this.config!.profiles[name];
    
    this.config!.profiles[name] = {
      ...existingProfile,
      ...profile,
      name,
      updatedAt: now,
      createdAt: existingProfile?.createdAt || now
    };

    await this.saveConfig();
  }

  /**
   * Remove a profile and its API key
   */
  async removeProfile(name: string): Promise<void> {
    await this.init();
    
    if (!this.config!.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    // Remove API key from auth file
    if (this.authData!.tokens[name]) {
      delete this.authData!.tokens[name];
      await this.saveAuth();
    }

    // Remove profile from config
    delete this.config!.profiles[name];

    // If this was the default profile, reset to another profile or empty
    if (this.config!.defaultProfile === name) {
      const remainingProfiles = Object.keys(this.config!.profiles);
      this.config!.defaultProfile = remainingProfiles.length > 0 ? remainingProfiles[0]! : DEFAULT_PROFILE;
    }

    await this.saveConfig();
  }

  /**
   * List all profile names
   */
  async listProfiles(): Promise<string[]> {
    await this.init();
    return Object.keys(this.config!.profiles);
  }

  /**
   * Get the default profile name
   */
  async getDefaultProfile(): Promise<string> {
    await this.init();
    return this.config!.defaultProfile;
  }

  /**
   * Set the default profile
   */
  async setDefaultProfile(name: string): Promise<void> {
    await this.init();
    
    if (!this.config!.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    this.config!.defaultProfile = name;
    await this.saveConfig();
  }

  /**
   * Store an API key (Vercel-style: in separate auth.json with chmod 600)
   */
  async setApiKey(profileName: string, apiKey: string): Promise<void> {
    await this.init();
    
    // Store in auth file (like Vercel's ~/.vercel/auth.json)
    this.authData!.tokens[profileName] = apiKey;
    await this.saveAuth();
    
    // Ensure profile exists
    if (!this.config!.profiles[profileName]) {
      this.config!.profiles[profileName] = { name: profileName };
      await this.saveConfig();
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

    await this.init();
    return this.authData!.tokens[profileName] || null;
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(profileName: string): Promise<void> {
    await this.init();
    
    if (this.authData!.tokens[profileName]) {
      delete this.authData!.tokens[profileName];
      await this.saveAuth();
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
    await this.init();
    return { ...this.config! };
  }

  /**
   * Clear all configuration and API keys
   */
  async clear(): Promise<void> {
    await this.init();

    // Clear auth data
    this.authData = {
      tokens: {}
    };
    await this.saveAuth();

    // Reset config
    this.config = {
      defaultProfile: DEFAULT_PROFILE,
      profiles: {}
    };
    await this.saveConfig();
  }
}

// Export singleton instance
export const configStore = new ConfigStore();