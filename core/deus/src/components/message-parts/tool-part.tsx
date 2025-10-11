/**
 * Tool Part Renderer for Ink.js
 * Renders tool calls (run_coding_tool) with status indicators
 */

import * as React from 'react';
import { Box, Text } from 'ink';
import type { RunCodingToolUIPart } from '@repo/deus-types';

export interface ToolPartProps {
  toolPart: RunCodingToolUIPart;
}

/**
 * ToolPart Component
 * Displays tool call information with appropriate status indicators
 */
export function ToolPart({ toolPart }: ToolPartProps) {
  const { state, input, output, errorText } = toolPart;

  // Determine status icon and color
  const getStatusDisplay = () => {
    switch (state) {
      case 'input-streaming':
        return { icon: '⏳', color: 'yellow', label: 'Streaming...' };
      case 'input-available':
        return { icon: '⚙️', color: 'blue', label: 'Ready' };
      case 'output-available':
        return { icon: '✅', color: 'green', label: 'Completed' };
      case 'output-error':
        return { icon: '❌', color: 'red', label: 'Error' };
      default:
        return { icon: '•', color: 'gray', label: 'Unknown' };
    }
  };

  const status = getStatusDisplay();
  const agentName = input?.type === 'claude-code' ? 'Claude Code' : 'Codex';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={status.color} paddingX={1} marginY={0}>
      {/* Header */}
      <Box>
        <Text color={status.color} bold>
          {status.icon} {agentName}
        </Text>
        <Text dimColor> • {status.label}</Text>
      </Box>

      {/* Task description */}
      {input && (
        <Box paddingLeft={2} paddingTop={0}>
          <Text dimColor>Task: </Text>
          <Text>{input.task}</Text>
        </Box>
      )}

      {/* MCP servers (if any) */}
      {input?.mcpServers && input.mcpServers.length > 0 && (
        <Box paddingLeft={2}>
          <Text dimColor>MCP: </Text>
          <Text>{input.mcpServers.join(', ')}</Text>
        </Box>
      )}

      {/* Output message (if completed) */}
      {output && state === 'output-available' && (
        <>
          <Box paddingLeft={2}>
            <Text dimColor>Status: </Text>
            <Text color="green">{output.status}</Text>
          </Box>
          {output.message && (
            <Box paddingLeft={2}>
              <Text dimColor>{output.message}</Text>
            </Box>
          )}
          {output.executionTime && (
            <Box paddingLeft={2}>
              <Text dimColor>Duration: </Text>
              <Text>{(output.executionTime / 1000).toFixed(1)}s</Text>
            </Box>
          )}
        </>
      )}

      {/* Error message (if failed) */}
      {errorText && state === 'output-error' && (
        <Box paddingLeft={2}>
          <Text color="red">{errorText}</Text>
        </Box>
      )}
    </Box>
  );
}
