import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import type { Lightfast, LightfastJSON, LightfastAgentSet, LightfastMetadata, LightfastDevConfig } from 'lightfast/client';

/**
 * Service for discovering and loading Lightfast configurations
 */
export class AgentDiscoveryService {
  private static instance: AgentDiscoveryService;
  private configCache: LightfastJSON | null = null;
  private lastCheckTime: number = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds cache

  private constructor() {}

  static getInstance(): AgentDiscoveryService {
    if (!AgentDiscoveryService.instance) {
      AgentDiscoveryService.instance = new AgentDiscoveryService();
    }
    return AgentDiscoveryService.instance;
  }

  /**
   * Discover Lightfast configuration from the user's project
   */
  async discoverConfig(): Promise<LightfastJSON> {
    // Check cache
    const now = Date.now();
    if (this.configCache && (now - this.lastCheckTime) < this.CACHE_TTL) {
      return this.configCache;
    }

    try {
      // Look for configuration files in common locations
      const projectRoot = this.findProjectRoot();
      const configPaths = [
        path.join(projectRoot, 'lightfast.config.mjs'),
        path.join(projectRoot, 'lightfast.config.js'),
        path.join(projectRoot, 'lightfast.config.ts'),
        path.join(projectRoot, 'src', 'lightfast.config.mjs'),
        path.join(projectRoot, 'src', 'lightfast.config.js'),
        path.join(projectRoot, 'src', 'lightfast.config.ts'),
      ];

      for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
          console.info(`Found Lightfast config at: ${configPath}`);
          
          // Dynamic import of the config file
          // @vite-ignore comment is needed because this is a runtime import of user config files
          const fileUrl = pathToFileURL(configPath).href;
          const module = await import(/* @vite-ignore */ fileUrl);
          
          // Extract the Lightfast instance
          const lightfast = module.default || module.lightfast;
          
          if (lightfast && typeof lightfast.toJSON === 'function') {
            const jsonConfig = lightfast.toJSON();
            this.configCache = jsonConfig;
            this.lastCheckTime = now;
            return jsonConfig;
          }
        }
      }

      // No config found, return default
      console.info('No Lightfast config found in project root');
      console.info('Create a lightfast.config.ts file to configure your agents');
      return this.getDefaultConfig();
      
    } catch (error) {
      console.error('Error discovering Lightfast config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Find the project root directory
   */
  private findProjectRoot(): string {
    // Start from current working directory
    let dir = process.cwd();
    
    // Walk up until we find package.json or reach root
    while (dir !== '/') {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    
    // Fallback to cwd
    return process.cwd();
  }

  /**
   * Get default configuration when no config is found
   */
  private getDefaultConfig(): LightfastJSON {
    return {
      agents: {}, // Empty Record<string, Agent>
      metadata: {
        name: "No Configuration Found",
        description: "Create a lightfast.config.ts file to define your agents",
        version: "0.0.0",
      },
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.configCache = null;
    this.lastCheckTime = 0;
  }
}