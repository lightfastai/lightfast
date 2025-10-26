/**
 * Welcome Screen Component
 * Shows model info, directory, and available commands (Codex-style)
 */

import * as React from 'react';
import { Box, Text } from 'ink';
import type { ActiveAgent } from '../lib/orchestrator.js';

interface WelcomeScreenProps {
  activeAgent: ActiveAgent;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = React.memo(({ activeAgent }) => {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Welcome Message */}
      <Box marginBottom={1}>
        <Text>To get started, describe a task or try one of these commands:</Text>
      </Box>

      {/* Commands List */}
      <Box flexDirection="column" marginLeft={0}>
        {getCommands(activeAgent).map((cmd) => (
          <Box key={cmd.name} marginBottom={0}>
            <Text color="cyan" bold>
              {cmd.name.padEnd(12)}
            </Text>
            <Text dimColor> - {cmd.description}</Text>
          </Box>
        ))}
      </Box>

      {/* Example Input */}
      <Box marginTop={2} marginBottom={1}>
        <Text dimColor>› </Text>
        <Text dimColor italic>
          Write tests for @filename
        </Text>
      </Box>

      {/* Shortcuts Hint */}
      <Box marginTop={1}>
        <Text dimColor>? for shortcuts</Text>
      </Box>
    </Box>
  );
});

/**
 * Helper: Get available commands
 */
function getCommands(agent: ActiveAgent): Array<{ name: string; description: string }> {
  const commonCommands = [
    { name: '/status', description: 'show current session configuration' },
    { name: '/model', description: 'choose what model and reasoning effort to use' },
    { name: '/review', description: 'review any changes and find issues' },
  ];

  switch (agent) {
    case 'deus':
      return [
        { name: '/init', description: 'create configuration for Deus orchestrator' },
        { name: '/agents', description: 'list available agents and their capabilities' },
        ...commonCommands,
      ];
    case 'claude-code':
      return [
        { name: '/init', description: 'create an AGENTS.md file with instructions' },
        ...commonCommands,
        { name: '/approval', description: 'requests for actions that need user approval' },
      ];
    case 'codex':
      return [
        { name: '/init', description: 'create an AGENTS.md file with instructions for Codex' },
        ...commonCommands,
        { name: '/approval', description: 'requests for actions that need user approval' },
      ];
  }
}
