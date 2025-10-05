import * as React from 'react';
import { Box, Text } from 'ink';
import { type OrchestrationState } from '../types/index.js';

interface StatusBarProps {
  state: OrchestrationState;
}

export const StatusBar: React.FC<StatusBarProps> = ({ state }) => {
  const getTaskSummary = () => {
    const tasks: string[] = [];

    if (state.claudeCode.status === 'running' && state.claudeCode.currentTask) {
      tasks.push(`CC: ${state.claudeCode.currentTask}`);
    }

    if (state.codex.status === 'running' && state.codex.currentTask) {
      tasks.push(`CX: ${state.codex.currentTask}`);
    }

    return tasks.length > 0 ? tasks.join(' | ') : 'Ready';
  };

  const getTotalMessages = () => {
    return state.claudeCode.messages.length + state.codex.messages.length;
  };

  const getSharedContextCount = () => {
    return Object.keys(state.sharedContext).length;
  };

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={2}
      paddingY={0}
      justifyContent="space-between"
    >
      <Box gap={3}>
        <Text color="gray">Status:</Text>
        <Text color="cyan">{getTaskSummary()}</Text>
      </Box>

      <Box gap={3}>
        <Text color="gray">Messages: {getTotalMessages()}</Text>
        <Text color="gray">Shared: {getSharedContextCount()}</Text>
        <Text color="yellow">Deus Orchestrator</Text>
      </Box>
    </Box>
  );
};
