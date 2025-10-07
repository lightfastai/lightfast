import * as React from 'react';
import { render } from 'ink';
import { App } from './components/app.js';
import { runHeadless, formatHeadlessOutput } from './lib/utils/headless.js';

// Parse command-line arguments
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

// Run in headless mode if flag is present
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
