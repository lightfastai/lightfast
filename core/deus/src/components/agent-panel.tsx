import * as React from 'react';
import { Box, Text } from 'ink';
import { type AgentState } from '../types/index.js';

const { useState, useEffect } = React;

// Simple spinner component using Ink's built-in features
const Spinner: React.FC = () => {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return <Text>{frames[frame]}</Text>;
};

interface AgentPanelProps {
  agent: AgentState;
  isActive: boolean;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ agent, isActive }) => {
  const getBorderColor = () => {
    if (!isActive) return 'gray';
    if (agent.status === 'running') return 'green';
    if (agent.status === 'error') return 'red';
    if (agent.status === 'waiting') return 'yellow';
    return 'cyan'; // Active border is cyan
  };

  const getBorderStyle = () => {
    return isActive ? 'double' : 'round';
  };

  const getStatusIcon = () => {
    switch (agent.status) {
      case 'running':
        return <Spinner />;
      case 'error':
        return <Text color="red">✗</Text>;
      case 'waiting':
        return <Text color="yellow">⏸</Text>;
      case 'idle':
        return <Text color="gray">○</Text>;
      default:
        return null;
    }
  };

  const title = agent.type === 'claude-code' ? 'Claude Code' : 'Codex';

  return (
    <Box
      flexDirection="column"
      borderStyle={getBorderStyle()}
      borderColor={getBorderColor()}
      padding={1}
      width="50%"
    >
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color={isActive ? 'cyan' : 'gray'} inverse={isActive}>
            {isActive ? '◆ ' : '  '}
            {title}
            {isActive ? ' ◆' : ''}
          </Text>
        </Box>
        <Box gap={1}>
          {getStatusIcon()}
          <Text color="gray">{agent.status.toUpperCase()}</Text>
        </Box>
      </Box>

      {/* Current Task */}
      {agent.currentTask && (
        <Box marginBottom={1}>
          <Text color="yellow">▸ {agent.currentTask}</Text>
        </Box>
      )}

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1}>
        {agent.messages.slice(-5).map((msg) => (
          <Box key={msg.id} marginBottom={0}>
            <Text
              color={
                msg.role === 'user'
                  ? 'cyan'
                  : msg.role === 'assistant'
                    ? 'green'
                    : 'gray'
              }
              dimColor={msg.role === 'system'}
            >
              {msg.role === 'user' ? '→ ' : msg.role === 'assistant' ? '← ' : '• '}
              {msg.content.slice(0, 60)}
              {msg.content.length > 60 ? '...' : ''}
            </Text>
          </Box>
        ))}
        {agent.messages.length === 0 && (
          <Text color="gray" dimColor>
            No messages yet...
          </Text>
        )}
      </Box>
    </Box>
  );
};
