/**
 * Approval Prompt Component
 * Displays approval requests from Claude Code and allows user to approve/reject
 */

import * as React from 'react';
import { Box, Text, useInput } from 'ink';
import type { ApprovalPrompt } from '../lib/spawners/base-spawner.js';

export interface ApprovalPromptProps {
  approval: ApprovalPrompt;
  onApprove: () => void;
  onReject: () => void;
  isFocused?: boolean;
}

/**
 * ApprovalPrompt Component
 * Renders an approval prompt with keyboard handling
 */
export function ApprovalPrompt({
  approval,
  onApprove,
  onReject,
  isFocused = true,
}: ApprovalPromptProps) {
  // Handle keyboard input
  useInput((input, key) => {
    if (!isFocused) return;

    // Approve on 'y' or 'Y'
    if (input === 'y' || input === 'Y') {
      onApprove();
    }
    // Reject on 'n' or 'N'
    else if (input === 'n' || input === 'N') {
      onReject();
    }
    // Also allow Enter for approve (common UX pattern)
    else if (key.return) {
      onApprove();
    }
    // Allow Escape or Ctrl+C to reject
    else if (key.escape || (key.ctrl && input === 'c')) {
      onReject();
    }
  });

  // Parse prompt text for display
  const lines = approval.prompt.split('\n').filter(l => l.trim());

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      padding={1}
      marginY={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⚠️  Approval Required
        </Text>
      </Box>

      {/* Prompt text */}
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      </Box>

      {/* Options */}
      <Box flexDirection="column">
        <Box>
          <Text dimColor>Press </Text>
          <Text bold color="green">[y]</Text>
          <Text dimColor> to approve (option 1), </Text>
          <Text bold color="red">[n]</Text>
          <Text dimColor> to reject (option 3)</Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor italic>
            Claude Code options: 1=Yes | 2=Yes+allow | 3=No
          </Text>
        </Box>
      </Box>

      {/* Debug info (only in DEBUG mode) */}
      {process.env.DEBUG && (
        <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
          <Box flexDirection="column">
            <Text dimColor>Debug Info:</Text>
            <Text dimColor>Options: {JSON.stringify(approval.options)}</Text>
            <Text dimColor>Raw length: {approval.rawData.length} chars</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
