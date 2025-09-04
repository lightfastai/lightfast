import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { CONFIG_DIR, CONFIG_FILE, KEYTAR_SERVICE, DEFAULT_PROFILE, getApiUrl } from './config-constants.js';

// Keytar module - will be loaded dynamically
let keytar: any = null;
let keytarError: string | null = null;

const SERVICE_NAME = KEYTAR_SERVICE;
const CONFIG_DIR_PATH = join(homedir(), CONFIG_DIR);
const CONFIG_FILE_PATH = join(CONFIG_DIR_PATH, CONFIG_FILE);

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

export class ConfigStore {
  private config: Config | null = null;

  /**
   * Load keytar module dynamically
   */
  private async loadKeytar(): Promise<boolean> {
    if (keytar !== null) return true;
    if (keytarError !== null) return false;

    try {
      keytar = await import('keytar');
      return true;
    } catch (error: any) {
      keytarError = error.message || 'Failed to load keytar';
      return false;
    }
  }

  /**
   * Initialize the config store and ensure the config directory exists
   */
  private async init(): Promise<void> {
    if (this.config !== null) return;

    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create config directory: ${error}`);
    }

    await this.loadConfig();
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
   * Get a profile by name (or default profile if no name provided)
   */
  async getProfile(name?: string): Promise<Profile | null> {
    await this.init();
    
    if (!name) {
      name = this.config!.defaultProfile;
    }

    return this.config!.profiles[name] || null;
  }

  /**
   * Set or update a profile
   */
  async setProfile(name: string, data: Partial<Profile>): Promise<void> {
    await this.init();

    const now = new Date().toISOString();
    const existing = this.config!.profiles[name];
    
    this.config!.profiles[name] = {
      name,
      endpoint: getApiUrl(), // Default endpoint
      ...existing,
      ...data,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    await this.saveConfig();
  }

  /**
   * Remove a profile and its API key from keychain
   */
  async removeProfile(name: string): Promise<void> {
    await this.init();

    if (!this.config!.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    // Remove API key from keychain
    const keytarAvailable = await this.loadKeytar();
    if (keytarAvailable) {
      try {
        await keytar.deletePassword(SERVICE_NAME, name);
      } catch (error) {
        // Keychain errors are non-fatal for profile removal
        console.warn(`Warning: Could not remove API key from keychain: ${error}`);
      }
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
   * Store an API key securely in the OS keychain
   */
  async setApiKey(profileName: string, apiKey: string): Promise<void> {
    const keytarAvailable = await this.loadKeytar();
    if (!keytarAvailable) {
      throw new Error(`Cannot store API key: keychain not available. ${keytarError || 'Unknown error'}`);
    }

    try {
      await keytar.setPassword(SERVICE_NAME, profileName, apiKey);
    } catch (error) {
      throw new Error(`Failed to store API key in keychain: ${error}. Your system may not support secure storage.`);
    }
  }

  /**
   * Retrieve an API key from the OS keychain
   */
  async getApiKey(profileName: string): Promise<string | null> {
    const keytarAvailable = await this.loadKeytar();
    if (!keytarAvailable) {
      return null;
    }

    try {
      const password = await keytar.getPassword(SERVICE_NAME, profileName);
      return password || null;
    } catch (error) {
      console.warn(`Warning: Could not retrieve API key from keychain: ${error}`);
      return null;
    }
  }

  /**
   * Check if keychain is available on this system
   */
  async isKeychainAvailable(): Promise<boolean> {
    const keytarAvailable = await this.loadKeytar();
    if (!keytarAvailable) {
      return false;
    }

    try {
      // Test keychain availability by attempting a simple operation
      await keytar.findCredentials(SERVICE_NAME);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the config file path for debugging
   */
  getConfigPath(): string {
    return CONFIG_FILE_PATH;
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

    // Remove all API keys from keychain
    const keytarAvailable = await this.loadKeytar();
    if (keytarAvailable) {
      const profileNames = Object.keys(this.config!.profiles);
      for (const profileName of profileNames) {
        try {
          await keytar.deletePassword(SERVICE_NAME, profileName);
        } catch (error) {
          // Non-fatal
          console.warn(`Warning: Could not remove API key for profile '${profileName}': ${error}`);
        }
      }
    }

    // Reset config
    this.config = {
      defaultProfile: DEFAULT_PROFILE,
      profiles: {}
    };

    await this.saveConfig();
  }
}

// Export a singleton instance
export const configStore = new ConfigStore();