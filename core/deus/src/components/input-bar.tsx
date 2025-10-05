import * as React from 'react';
import { Box, Text, useInput } from 'ink';
import { type AgentType } from '../types/index.js';

const { useState } = React;

interface InputBarProps {
  activeAgent: AgentType;
  onSubmit: (value: string) => void;
  onSwitch: () => void;
  isFocused: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({
  activeAgent,
  onSubmit,
  onSwitch,
  isFocused,
}) => {
  const [value, setValue] = useState('');

  useInput(
    (input, key) => {
      if (!isFocused) return;

      // Handle Tab for switching agents
      if (key.tab) {
        onSwitch();
        return;
      }

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
    { isActive: isFocused }
  );

  const agentName = activeAgent === 'claude-code' ? 'Claude Code' : 'Codex';
  const agentColor = activeAgent === 'claude-code' ? 'cyan' : 'magenta';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={agentColor} padding={1}>
      {/* Agent selector hint */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text color={agentColor} bold inverse>
            ▶ {agentName}
          </Text>
          <Text color="gray" dimColor>
            {' '}
            (Tab to switch • Coordinates with Deus)
          </Text>
        </Box>
        <Box gap={2}>
          <Text color="gray" dimColor>
            Ctrl+C exit
          </Text>
          <Text color="gray" dimColor>
            Ctrl+S share
          </Text>
          <Text color="gray" dimColor>
            Ctrl+K clear
          </Text>
        </Box>
      </Box>

      {/* Input field */}
      <Box>
        <Text color={agentColor} bold>▸ </Text>
        <Text>
          {value}
          {isFocused && <Text inverse> </Text>}
        </Text>
      </Box>
    </Box>
  );
};
