/**
 * Migration utilities for auth.json to profile system
 *
 * IMPORTANT: This file is kept for potential future use but is NOT currently
 * used anywhere in the codebase. No automatic migration happens.
 *
 * These utilities can be used manually if needed, but since we're not in
 * production yet and have no existing users, automatic migration is not needed.
 *
 * This is a standalone utility that can be run to manually migrate old configs
 * if we ever need it in the future.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getActiveProfile,
  createProfile,
  setActiveProfile,
  type ProfileConfig,
  getDefaultApiUrl,
} from './profile-config.js';

/**
 * Old auth config structure
 */
interface OldAuthConfig {
  apiKey?: string;
  apiUrl?: string;
  defaultOrgId?: string;
  defaultOrgSlug?: string;
  organizations?: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
}

/**
 * Get path to old auth.json file
 */
export function getOldAuthPath(): string {
  return path.join(os.homedir(), '.deus', 'auth.json');
}

/**
 * Check if old auth.json exists
 */
export function hasOldAuthConfig(): boolean {
  return fs.existsSync(getOldAuthPath());
}

/**
 * Load old auth.json file
 */
export function loadOldAuthConfig(): OldAuthConfig | null {
  const authPath = getOldAuthPath();

  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(authPath, 'utf-8');
    return JSON.parse(content) as OldAuthConfig;
  } catch (error) {
    console.error(
      'Error reading old auth.json:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Migrate old auth.json to new profile system
 * Returns true if migration was performed, false if no migration needed
 */
export function migrateAuthConfig(
  options: {
    profileName?: string;
    deleteOld?: boolean;
    force?: boolean;
  } = {}
): boolean {
  const { profileName = 'default', deleteOld = true, force = false } = options;

  const oldAuthPath = getOldAuthPath();

  // Check if old config exists
  if (!fs.existsSync(oldAuthPath)) {
    if (process.env.DEBUG) {
      console.log('[Migration] No old auth.json found, skipping migration');
    }
    return false;
  }

  try {
    // Load old config
    const oldConfig = loadOldAuthConfig();
    if (!oldConfig) {
      console.error('[Migration] Failed to load old auth.json');
      return false;
    }

    // Check if profile already exists
    const existingProfile = getActiveProfile();
    if (existingProfile.apiKey && !force) {
      console.log('[Migration] Profile already configured, skipping migration');
      console.log('[Migration] Use force=true to override');
      return false;
    }

    // Create profile config from old config
    const profileConfig: ProfileConfig = {
      apiKey: oldConfig.apiKey,
      apiUrl: oldConfig.apiUrl || getDefaultApiUrl(),
      defaultOrgId: oldConfig.defaultOrgId,
      defaultOrgSlug: oldConfig.defaultOrgSlug,
      organizations: oldConfig.organizations || [],
    };

    // Try to create new profile
    try {
      createProfile(profileName, profileConfig);
      console.log(`[Migration] Created profile '${profileName}' from old auth.json`);
    } catch (error) {
      // Profile might already exist - that's OK if force is true
      if (force) {
        console.log(`[Migration] Profile '${profileName}' already exists, updating...`);
      } else {
        throw error;
      }
    }

    // Set as active profile
    try {
      setActiveProfile(profileName);
    } catch (error) {
      // Ignore error if already active
    }

    // Delete old file if requested
    if (deleteOld) {
      fs.unlinkSync(oldAuthPath);
      console.log('[Migration] Deleted old auth.json file');

      // Try to remove .deus directory if empty
      const deusDir = path.dirname(oldAuthPath);
      try {
        const files = fs.readdirSync(deusDir);
        if (files.length === 0) {
          fs.rmdirSync(deusDir);
          console.log('[Migration] Removed empty .deus directory');
        }
      } catch (error) {
        // Ignore errors when removing directory
      }
    }

    console.log('[Migration] Successfully migrated to new profile system');
    return true;
  } catch (error) {
    console.error(
      '[Migration] Failed to migrate:',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

/**
 * Run migration automatically on first run
 *
 * NOTE: This function is NOT exported or called automatically.
 * It's kept here for reference but should not be used unless we
 * have production users who need migration.
 */
function autoMigrate(): void {
  if (hasOldAuthConfig()) {
    console.log('Detected old authentication configuration...');
    const success = migrateAuthConfig({
      profileName: 'default',
      deleteOld: true,
      force: false,
    });

    if (success) {
      console.log('✓ Successfully migrated to new profile system');
      console.log('  Your authentication is now stored in a profile named "default"');
      console.log('  Use "deus profile list" to see your profiles');
    }
  }
}
