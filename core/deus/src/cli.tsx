import * as React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from './components/app.js';
import { runHeadless, formatHeadlessOutput } from './lib/utils/headless.js';
import {
  authLogin,
  authLogout,
  authStatus,
  orgList,
  orgSelect,
} from './lib/commands/auth.js';
import {
  profileList,
  profileShow,
  profileCreate,
  profileSwitch,
  profileDelete,
  profilePath,
} from './lib/commands/profile.js';

// Create commander program
const program = new Command();

program
  .name('deus')
  .description('Terminal UI for orchestrating Claude Code & Codex agents')
  .version('0.1.0');

// Auth commands
const auth = program
  .command('auth')
  .description('Manage authentication');

auth
  .command('login <apiKey>')
  .description('Login with an API key')
  .action(async (apiKey: string) => {
    await authLogin(apiKey);
  });

auth
  .command('logout')
  .description('Logout and clear credentials')
  .action(async () => {
    await authLogout();
  });

auth
  .command('status')
  .description('Show authentication status')
  .action(async () => {
    await authStatus();
  });

// Organization commands
const org = program
  .command('org')
  .description('Manage organizations');

org
  .command('list')
  .description('List available organizations')
  .action(async () => {
    await orgList();
  });

org
  .command('select <slug>')
  .description('Select default organization')
  .action(async (slug: string) => {
    await orgSelect(slug);
  });

// Profile commands
const profile = program
  .command('profile')
  .description('Manage configuration profiles');

profile
  .command('list')
  .description('List all profiles')
  .action(async () => {
    await profileList();
  });

profile
  .command('show [name]')
  .description('Show profile details (defaults to active profile)')
  .action(async (name?: string) => {
    await profileShow(name);
  });

profile
  .command('create [name]')
  .description('Create a new profile')
  .action(async (name?: string) => {
    await profileCreate(name);
  });

profile
  .command('switch [name]')
  .description('Switch to a different profile')
  .action(async (name?: string) => {
    await profileSwitch(name);
  });

profile
  .command('delete [name]')
  .description('Delete a profile')
  .action(async (name?: string) => {
    await profileDelete(name);
  });

profile
  .command('path')
  .description('Show config file path')
  .action(async () => {
    await profilePath();
  });

// Headless mode (for backwards compatibility)
program
  .command('run')
  .description('Run Deus in headless mode')
  .option('--agent <agent>', 'Specify agent (claude-code or codex)')
  .option('--json', 'Output in JSON format')
  .argument('<message>', 'Message to send to the agent')
  .action(async (message: string, options: { agent?: string; json?: boolean }) => {
    const agent = options.agent as 'claude-code' | 'codex' | undefined;
    const result = await runHeadless({ agent, message, json: options.json ?? false });
    console.log(formatHeadlessOutput(result, options.json ?? false));
    process.exit(result.success ? 0 : 1);
  });

// Default action - launch TUI
program
  .action(() => {
    // Check if running with --headless flag (backwards compatibility)
    const args = process.argv.slice(2);
    const isHeadless = args.includes('--headless');
    const isJson = args.includes('--json');
    const agentFlag = args.indexOf('--agent');
    const agent = agentFlag >= 0 ? args[agentFlag + 1] as 'claude-code' | 'codex' : undefined;

    // Get message (everything after flags)
    const message = args
      .filter(arg => !arg.startsWith('--') && arg !== agent)
      .join(' ')
      .trim();

    if (isHeadless) {
      if (!message) {
        console.error('Error: --headless requires a message');
        console.error('Usage: deus --headless [--agent claude-code|codex] [--json] "your message"');
        process.exit(1);
      }

      runHeadless({ agent, message, json: isJson })
        .then(result => {
          console.log(formatHeadlessOutput(result, isJson));
          process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
          console.error('Fatal error:', error);
          process.exit(1);
        });
    } else {
      // Render the TUI app
      const { waitUntilExit } = render(<App />);

      // Wait for exit
      waitUntilExit().catch(console.error);
    }
  });

// Parse CLI arguments
program.parse();
