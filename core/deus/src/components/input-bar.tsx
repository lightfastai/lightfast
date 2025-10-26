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

  const placeholder = getPlaceholder(activeAgent);

  return (
    <Box borderStyle="single" borderTop borderBottom borderLeft={false} borderRight={false}>
      <Text bold>› </Text>
      <Text>
        {value || <Text dimColor>{placeholder}</Text>}
        <Text inverse={isFocused && !isLoading}> </Text>
      </Text>
    </Box>
  );
});

/**
 * Helper: Get placeholder text
 */
function getPlaceholder(agent: ActiveAgent): string {
  switch (agent) {
    case 'deus':
      return 'Describe a task or type a command...';
    case 'claude-code':
      return 'Describe a task or type a command...';
    case 'codex':
      return 'Describe a task or type a command...';
  }
}
