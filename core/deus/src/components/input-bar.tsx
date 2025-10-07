/**
 * Input Bar Component
 * Handles user input with context-aware prompts
 */

import * as React from 'react';
import { Box, Text, useInput } from 'ink';
import type { ActiveAgent } from '../lib/orchestrator.js';

const { useState } = React;

interface InputBarProps {
  activeAgent: ActiveAgent;
  onSubmit: (value: string) => void;
  isFocused: boolean;
  isLoading: boolean;
}

export const InputBar: React.FC<InputBarProps> = React.memo(({
  activeAgent,
  onSubmit,
  isFocused,
  isLoading,
}) => {
  const [value, setValue] = useState('');

  useInput(
    (input, key) => {
      if (!isFocused || isLoading) return;

      if (key.return) {
        if (value.trim()) {
          onSubmit(value);
          setValue('');
        }
      } else if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setValue((v) => v + input);
      }
    },
    { isActive: isFocused && !isLoading }
  );

  const agentInfo = getAgentInfo(activeAgent);
  const placeholder = getPlaceholder(activeAgent);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={agentInfo.color} padding={1}>
      {/* Hint */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={agentInfo.color} bold>
            {agentInfo.icon} {agentInfo.name}
          </Text>
          {activeAgent !== 'deus' && (
            <Text color="gray" dimColor>
              {' '}• Type "back" to return to Deus
            </Text>
          )}
        </Box>
        <Box>
          <Text color="gray" dimColor>
            {isLoading ? 'Thinking...' : 'Ready'}
          </Text>
        </Box>
      </Box>

      {/* Input field */}
      <Box>
        <Text color={agentInfo.color} bold>
          {agentInfo.symbol}{' '}
        </Text>
        <Text>
          {value || <Text dimColor>{placeholder}</Text>}
          <Text inverse={isFocused && !isLoading}> </Text>
        </Text>
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
  symbol: string;
  color: 'cyan' | 'magenta' | 'yellow';
} {
  switch (agent) {
    case 'deus':
      return { name: 'Deus', icon: '🎭', symbol: '▸', color: 'cyan' };
    case 'claude-code':
      return { name: 'Claude Code', icon: '🤖', symbol: '▸', color: 'magenta' };
    case 'codex':
      return { name: 'Codex', icon: '⚡', symbol: '▸', color: 'yellow' };
  }
}

/**
 * Helper: Get placeholder text
 */
function getPlaceholder(agent: ActiveAgent): string {
  switch (agent) {
    case 'deus':
      return 'Tell me what you need help with...';
    case 'claude-code':
      return 'Message Claude Code...';
    case 'codex':
      return 'Message Codex...';
  }
}
