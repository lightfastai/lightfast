/**
 * Status Bar Component
 * Shows active agent, session info, and job type
 */

import * as React from 'react';
import { Box, Text } from 'ink';
import type { ActiveAgent } from '../lib/simple-orchestrator.js';

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
  const agentInfo = getAgentInfo(activeAgent);

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={agentInfo.color} paddingX={1}>
      {/* Title */}
      <Box justifyContent="center">
        <Text bold color={agentInfo.color} inverse>
          {' '}
          {agentInfo.icon} DEUS v2.0 - {agentInfo.name}{' '}
        </Text>
      </Box>

      {/* Status Info */}
      <Box marginTop={1} justifyContent="space-between">
        <Box gap={2}>
          {sessionId && (
            <Box>
              <Text color="gray" dimColor>
                Session:
              </Text>
              <Text color="yellow">
                {' '}
                {sessionId.slice(0, 8)}...
              </Text>
            </Box>
          )}

          {jobType && (
            <Box>
              <Text color="gray" dimColor>
                Job:
              </Text>
              <Text color="cyan">
                {' '}
                {jobType}
              </Text>
            </Box>
          )}
        </Box>

        <Box>
          <Text color="gray" dimColor>
            {activeAgent !== 'deus' ? 'Ctrl+B back • ' : ''}Ctrl+C exit
          </Text>
        </Box>
      </Box>
    </Box>
  );
});

/**
 * Helper: Get agent info
 */
function getAgentInfo(agent: ActiveAgent): {
  name: string;
  icon: string;
  color: 'cyan' | 'magenta' | 'yellow';
} {
  switch (agent) {
    case 'deus':
      return { name: 'Deus Router', icon: '🎭', color: 'cyan' };
    case 'claude-code':
      return { name: 'Claude Code', icon: '🤖', color: 'magenta' };
    case 'codex':
      return { name: 'Codex', icon: '⚡', color: 'yellow' };
  }
}
