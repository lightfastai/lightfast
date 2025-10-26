/**
 * Status Bar Component
 * Minimal header showing active session info (Codex-style)
 */

import * as React from 'react';
import { Box, Text } from 'ink';
import type { ActiveAgent } from '../lib/orchestrator.js';

interface StatusBarProps {
  activeAgent: ActiveAgent;
  sessionId: string | null;
  jobType: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = React.memo(({
  activeAgent,
  sessionId,
  jobType,
}) => {
  const cwd = process.cwd();

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {/* First line: deus session */}
      <Box justifyContent="space-between" width="100%">
        <Box>
          <Text>deus</Text>
          {sessionId && (
            <Text dimColor> session: {sessionId.slice(0, 8)}</Text>
          )}
        </Box>

        <Box>
          <Text dimColor>
            {activeAgent !== 'deus' ? 'Ctrl+B back • ' : ''}Ctrl+C exit
          </Text>
        </Box>
      </Box>

      {/* Directory */}
      <Box marginTop={1}>
        <Text bold>directory:   </Text>
        <Text dimColor>{cwd}</Text>
      </Box>

      {/* Supported Spawners */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Supported spawners:</Text>
        <Box marginLeft={2}>
          <Text dimColor>• Claude Code (claude-sonnet-4-5)</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>• Codex (gpt-5-codex-high)</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>• Deus Router (gpt-4-turbo)</Text>
        </Box>
      </Box>
    </Box>
  );
});
