/**
 * Profile Commands
 * Manage configuration profiles for different environments/accounts
 */

import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import {
  getActiveProfileName,
  getActiveProfile,
  setActiveProfile,
  listProfiles,
  createProfile,
  deleteProfile,
  getProfile,
  getConfigPath,
  type ProfileConfig,
} from '../config/profile-config.js';

/**
 * List all profiles
 */
export async function profileList(): Promise<void> {
  const profiles = listProfiles();
  const activeProfileName = getActiveProfileName();

  if (profiles.length === 0) {
    console.log(chalk.yellow('No profiles found'));
    console.log('');
    console.log(chalk.dim('Create a profile with:'), chalk.cyan('deus profile create <name>'));
    return;
  }

  console.log(chalk.bold('Available Profiles:'));
  console.log('');

  for (const profileName of profiles) {
    const isActive = profileName === activeProfileName;
    const profile = getProfile(profileName);

    if (!profile) continue;

    const marker = isActive ? chalk.green('(*) ') : '    ';
    const name = isActive ? chalk.green.bold(profileName) : chalk.white(profileName);

    // Build status line
    const statusParts: string[] = [];

    if (profile.apiKey) {
      const keyPreview = `...${profile.apiKey.slice(-4)}`;
      statusParts.push(chalk.dim('API Key:') + ' ' + chalk.white(keyPreview));
    } else {
      statusParts.push(chalk.dim('Not authenticated'));
    }

    if (profile.defaultOrgSlug) {
      statusParts.push(chalk.dim('Org:') + ' ' + chalk.white(profile.defaultOrgSlug));
    }

    statusParts.push(chalk.dim('URL:') + ' ' + chalk.cyan(profile.apiUrl));

    console.log(`${marker}${name}`);
    console.log(`    ${statusParts.join(' | ')}`);
    console.log('');
  }

  if (activeProfileName) {
    console.log(chalk.dim('(*) = active profile'));
  }
}

/**
 * Show a specific profile (or active if not specified)
 */
export async function profileShow(profileName?: string): Promise<void> {
  const targetProfile = profileName || getActiveProfileName();
  const profile = getProfile(targetProfile);

  if (!profile) {
    console.error(chalk.red(`✗ Profile '${targetProfile}' not found`));
    console.log('');
    console.log(chalk.dim('Available profiles:'));
    const profiles = listProfiles();
    for (const p of profiles) {
      console.log(chalk.dim('  -'), chalk.cyan(p));
    }
    process.exit(1);
  }

  const isActive = targetProfile === getActiveProfileName();

  console.log(chalk.bold(`Profile: ${targetProfile}`) + (isActive ? chalk.green(' (active)') : ''));
  console.log('');

  // API Key
  if (profile.apiKey) {
    const keyPreview = `...${profile.apiKey.slice(-4)}`;
    console.log(chalk.dim('  API Key:'), chalk.white(keyPreview));
  } else {
    console.log(chalk.dim('  API Key:'), chalk.yellow('Not set'));
  }

  // API URL
  console.log(chalk.dim('  API URL:'), chalk.cyan(profile.apiUrl));

  // Default Organization
  if (profile.defaultOrgId && profile.defaultOrgSlug) {
    const org = profile.organizations.find((o) => o.id === profile.defaultOrgId);
    if (org) {
      console.log(chalk.dim('  Default Org:'), chalk.white(`${org.name} (${org.slug})`));
    } else {
      console.log(chalk.dim('  Default Org:'), chalk.white(profile.defaultOrgSlug));
    }
  } else {
    console.log(chalk.dim('  Default Org:'), chalk.yellow('Not set'));
  }

  // Organizations
  console.log('');
  if (profile.organizations.length > 0) {
    console.log(chalk.dim('  Organizations:'));
    for (const org of profile.organizations) {
      const isDefault = org.id === profile.defaultOrgId;
      const marker = isDefault ? chalk.green('  * ') : '    ';
      console.log(`${marker}${chalk.white(org.name)} ${chalk.dim(`(${org.slug})`)}`);
    }
  } else {
    console.log(chalk.dim('  Organizations:'), chalk.yellow('None'));
  }
}

/**
 * Create a new profile
 */
export async function profileCreate(profileName?: string): Promise<void> {
  let name = profileName;

  // If no name provided, prompt for it
  if (!name) {
    name = await input({
      message: 'Profile name:',
      validate: (value) => {
        if (!value.trim()) {
          return 'Profile name is required';
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return 'Profile name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      },
    });
  }

  // Check if profile already exists
  const existing = getProfile(name);
  if (existing) {
    console.error(chalk.red(`✗ Profile '${name}' already exists`));
    console.log('');
    console.log(chalk.dim('Use:'), chalk.cyan(`deus profile show ${name}`), chalk.dim('to view it'));
    console.log(chalk.dim('Use:'), chalk.cyan(`deus profile switch ${name}`), chalk.dim('to activate it'));
    process.exit(1);
  }

  try {
    // Create profile with default settings
    createProfile(name);

    console.log(chalk.green(`✓ Profile '${name}' created`));
    console.log('');
    console.log(chalk.dim('Next steps:'));
    console.log(chalk.dim('  1. Switch to profile:'), chalk.cyan(`deus profile switch ${name}`));
    console.log(chalk.dim('  2. Login:'), chalk.cyan('deus auth login <api-key>'));
  } catch (error) {
    console.error(chalk.red('✗ Failed to create profile'));
    console.error(
      chalk.dim('  Error:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

/**
 * Switch to a different profile
 */
export async function profileSwitch(profileName?: string): Promise<void> {
  const profiles = listProfiles();

  if (profiles.length === 0) {
    console.error(chalk.red('✗ No profiles available'));
    console.log('');
    console.log(chalk.dim('Create a profile with:'), chalk.cyan('deus profile create <name>'));
    process.exit(1);
  }

  let targetProfile = profileName;

  // If no profile specified, prompt user to select
  if (!targetProfile) {
    const currentProfile = getActiveProfileName();

    targetProfile = await select({
      message: 'Select profile to activate:',
      choices: profiles.map((p) => ({
        name: p === currentProfile ? `${p} (current)` : p,
        value: p,
      })),
    });
  }

  // Validate profile exists
  const profile = getProfile(targetProfile);
  if (!profile) {
    console.error(chalk.red(`✗ Profile '${targetProfile}' not found`));
    console.log('');
    console.log(chalk.dim('Available profiles:'));
    for (const p of profiles) {
      console.log(chalk.dim('  -'), chalk.cyan(p));
    }
    process.exit(1);
  }

  // Check if already active
  if (targetProfile === getActiveProfileName()) {
    console.log(chalk.yellow(`Profile '${targetProfile}' is already active`));
    return;
  }

  try {
    setActiveProfile(targetProfile);

    console.log(chalk.green(`✓ Switched to profile '${targetProfile}'`));
    console.log('');

    // Show profile status
    if (profile.apiKey) {
      const keyPreview = `...${profile.apiKey.slice(-4)}`;
      console.log(chalk.dim('  API Key:'), chalk.white(keyPreview));

      if (profile.defaultOrgSlug) {
        const org = profile.organizations.find((o) => o.id === profile.defaultOrgId);
        if (org) {
          console.log(chalk.dim('  Organization:'), chalk.white(`${org.name} (${org.slug})`));
        }
      }
    } else {
      console.log(chalk.yellow('  This profile is not authenticated'));
      console.log(chalk.dim('  Run:'), chalk.cyan('deus auth login <api-key>'));
    }
  } catch (error) {
    console.error(chalk.red('✗ Failed to switch profile'));
    console.error(
      chalk.dim('  Error:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

/**
 * Delete a profile
 */
export async function profileDelete(profileName?: string): Promise<void> {
  const profiles = listProfiles();
  const activeProfileName = getActiveProfileName();

  if (profiles.length === 0) {
    console.error(chalk.red('✗ No profiles available'));
    process.exit(1);
  }

  let targetProfile = profileName;

  // If no profile specified, prompt user to select
  if (!targetProfile) {
    // Filter out active profile from choices
    const deletableProfiles = profiles.filter((p) => p !== activeProfileName);

    if (deletableProfiles.length === 0) {
      console.error(chalk.red('✗ No profiles available to delete'));
      console.log(
        chalk.dim('  Cannot delete the active profile. Switch to another profile first.')
      );
      process.exit(1);
    }

    targetProfile = await select({
      message: 'Select profile to delete:',
      choices: deletableProfiles.map((p) => ({
        name: p,
        value: p,
      })),
    });
  }

  // Check if trying to delete active profile
  if (targetProfile === activeProfileName) {
    console.error(chalk.red(`✗ Cannot delete active profile '${targetProfile}'`));
    console.log('');
    console.log(chalk.dim('Switch to another profile first:'));
    console.log(chalk.cyan('  deus profile switch <name>'));
    process.exit(1);
  }

  // Validate profile exists
  const profile = getProfile(targetProfile);
  if (!profile) {
    console.error(chalk.red(`✗ Profile '${targetProfile}' not found`));
    process.exit(1);
  }

  // Confirm deletion
  const confirmed = await confirm({
    message: `Delete profile '${targetProfile}'?`,
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow('Deletion cancelled'));
    return;
  }

  try {
    deleteProfile(targetProfile);
    console.log(chalk.green(`✓ Profile '${targetProfile}' deleted`));
  } catch (error) {
    console.error(chalk.red('✗ Failed to delete profile'));
    console.error(
      chalk.dim('  Error:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

/**
 * Show config file path
 */
export async function profilePath(): Promise<void> {
  const configPath = getConfigPath();
  console.log(chalk.dim('Config file:'), chalk.cyan(configPath));
}
