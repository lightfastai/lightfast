/**
 * Authentication Commands
 * Handles auth login, logout, status, and organization management
 */

import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import {
  loadConfig,
  clearConfig,
  isAuthenticated,
  setApiKey,
  updateOrganizations,
  setDefaultOrganization,
  getApiUrl,
  type Organization,
} from '../config/config.js';
import {
  verifyApiKey,
  getUserOrganizations,
  isValidApiKeyFormat,
  type ApiOrganization,
} from '../api/client.js';

/**
 * Login command - authenticate with API key
 */
export async function authLogin(apiKey: string): Promise<void> {
  try {
    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      console.error(chalk.red('✗ Invalid API key format'));
      console.error(chalk.dim('  API keys should start with "deus_sk_"'));
      process.exit(1);
    }

    // Verify API key with server
    console.log(chalk.dim('Verifying API key...'));
    const verifyResult = await verifyApiKey(apiKey);
    console.log(chalk.green('✓ API key verified'));

    // Save API key
    setApiKey(apiKey);

    // Fetch user's organizations
    console.log(chalk.dim('Fetching organizations...'));
    const orgs = await getUserOrganizations(apiKey);

    if (orgs.length === 0) {
      console.error(chalk.red('✗ No organizations found for this user'));
      console.error(chalk.dim('  Please create an organization at https://deus.lightfast.ai'));
      process.exit(1);
    }

    // Convert API organizations to auth config format
    const configOrgs: Organization[] = orgs.map((org) => ({
      id: org.id,
      slug: org.slug,
      name: org.name,
    }));

    // Save organizations
    updateOrganizations(configOrgs);

    // Select default organization
    let defaultOrg: Organization;

    if (orgs.length === 1) {
      // Only one org, use it as default
      defaultOrg = configOrgs[0]!;
      console.log(chalk.dim(`Using organization: ${defaultOrg.name}`));
    } else {
      // Multiple orgs, prompt user to select
      const orgSlug = await select({
        message: 'Select default organization:',
        choices: configOrgs.map((org) => ({
          name: org.name,
          value: org.slug,
        })),
      });

      defaultOrg = configOrgs.find((org) => org.slug === orgSlug)!;
    }

    // Save default organization
    setDefaultOrganization(defaultOrg.id, defaultOrg.slug);

    // Success message
    const apiUrl = getApiUrl();
    console.log('');
    console.log(chalk.green('✓ Authentication successful!'));
    console.log(chalk.dim('  Organization:'), chalk.white(defaultOrg.name));
    console.log(chalk.dim('  API URL:'), chalk.white(apiUrl));
    console.log('');
    console.log(chalk.dim('You can now use Deus CLI to manage your sessions.'));
    console.log(chalk.dim('Try running:'), chalk.cyan('deus'));
  } catch (error) {
    console.error(chalk.red('✗ Authentication failed'));
    console.error(
      chalk.dim('  Error:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

/**
 * Logout command - clear authentication
 */
export async function authLogout(): Promise<void> {
  try {
    if (!isAuthenticated()) {
      console.log(chalk.yellow('You are not currently authenticated.'));
      return;
    }

    clearConfig();
    console.log(chalk.green('✓ Successfully logged out'));
  } catch (error) {
    console.error(chalk.red('✗ Logout failed'));
    console.error(
      chalk.dim('  Error:'),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

/**
 * Status command - show authentication status
 */
export async function authStatus(): Promise<void> {
  const config = loadConfig();

  if (!isAuthenticated()) {
    console.log(chalk.red('✗ Not authenticated'));
    console.log('');
    console.log(chalk.dim('To get started:'));
    console.log(chalk.dim('  1. Generate an API key at'), chalk.cyan('https://deus.lightfast.ai/settings/api-keys'));
    console.log(chalk.dim('  2. Run:'), chalk.cyan('deus auth login <api-key>'));
    return;
  }

  // Display authentication status
  const apiKeyPreview = config.apiKey
    ? `...${config.apiKey.slice(-4)}`
    : 'Not set';

  const defaultOrg = config.organizations.find(
    (org) => org.id === config.defaultOrgId
  );

  console.log(chalk.green('✓ Authenticated'));
  console.log(chalk.dim('  API Key:'), chalk.white(apiKeyPreview));

  if (defaultOrg) {
    console.log(chalk.dim('  Organization:'), chalk.white(`${defaultOrg.name} (${defaultOrg.slug})`));
  } else {
    console.log(chalk.dim('  Organization:'), chalk.yellow('Not set'));
  }

  console.log(chalk.dim('  API URL:'), chalk.white(getApiUrl()));
}

/**
 * List organizations command
 */
export async function orgList(): Promise<void> {
  if (!isAuthenticated()) {
    console.error(chalk.red('✗ Not authenticated'));
    console.error(chalk.dim('  Run:'), chalk.cyan('deus auth login <api-key>'));
    process.exit(1);
  }

  const config = loadConfig();

  if (config.organizations.length === 0) {
    console.log(chalk.yellow('No organizations found'));
    return;
  }

  console.log(chalk.bold('Your Organizations:'));
  console.log('');

  for (const org of config.organizations) {
    const isDefault = org.id === config.defaultOrgId;
    const marker = isDefault ? chalk.green('(*) ') : '    ';
    const name = isDefault ? chalk.green.bold(org.name) : chalk.white(org.name);
    const slug = chalk.dim(`(${org.slug})`);

    console.log(`${marker}${name} ${slug}`);
  }

  if (config.defaultOrgId) {
    console.log('');
    console.log(chalk.dim('(*) = default organization'));
  }
}

/**
 * Select organization command
 */
export async function orgSelect(slug: string): Promise<void> {
  if (!isAuthenticated()) {
    console.error(chalk.red('✗ Not authenticated'));
    console.error(chalk.dim('  Run:'), chalk.cyan('deus auth login <api-key>'));
    process.exit(1);
  }

  const config = loadConfig();

  // Find organization by slug
  const org = config.organizations.find((o) => o.slug === slug);

  if (!org) {
    console.error(chalk.red('✗ Organization not found:'), chalk.white(slug));
    console.log('');
    console.log(chalk.dim('Available organizations:'));
    for (const o of config.organizations) {
      console.log(chalk.dim('  -'), chalk.cyan(o.slug), chalk.dim(`(${o.name})`));
    }
    process.exit(1);
  }

  // Update default organization
  setDefaultOrganization(org.id, org.slug);

  console.log(chalk.green('✓ Default organization updated'));
  console.log(chalk.dim('  Organization:'), chalk.white(`${org.name} (${org.slug})`));
}
