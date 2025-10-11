/**
 * Message List Component for Ink.js
 * Displays a list of messages with parts (text, tool calls, etc.)
 */

import * as React from 'react';
import { Box, Text } from 'ink';
import type { LightfastAppDeusUIMessage } from '@repo/deus-types';
import { isTextPart, isToolPart, isRunCodingToolPart } from '@repo/deus-types';
import { TextPart } from './message-parts/text-part.js';
import { ToolPart } from './message-parts/tool-part.js';

export interface MessageListProps {
  messages: LightfastAppDeusUIMessage[];
  isStreaming?: boolean;
}

/**
 * MessageList Component
 * Renders a list of messages with their parts
 */
export function MessageList({ messages, isStreaming = false }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text dimColor italic>
          No messages yet. Start a conversation!
        </Text>
      </Box>
    );
  }

  // Determine which message is currently streaming (last assistant message)
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.role === 'assistant';

  return (
    <Box flexDirection="column">
      {messages.map((message, messageIndex) => {
        const isThisMessageStreaming = isLastMessageStreaming && messageIndex === messages.length - 1;

        return (
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={isThisMessageStreaming}
          />
        );
      })}
    </Box>
  );
}

/**
 * MessageItem Component
 * Renders a single message with all its parts
 */
function MessageItem({
  message,
  isStreaming,
}: {
  message: LightfastAppDeusUIMessage;
  isStreaming: boolean;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Get agent name from metadata
  const agentName = message.metadata?.agentType || 'assistant';
  const displayName = isUser ? 'You' : getAgentDisplayName(agentName);

  // Format timestamp
  const timestamp = message.metadata?.createdAt
    ? new Date(message.metadata.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  // System messages have special styling
  if (isSystem) {
    return (
      <Box paddingY={0} paddingX={1}>
        <Text dimColor italic>
          ℹ {message.parts.filter(isTextPart).map((p) => p.text).join(' ')}
        </Text>
      </Box>
    );
  }

  // Regular user/assistant messages
  return (
    <Box paddingY={0} paddingX={2} marginY={0} flexDirection="column">
      {/* Message header */}
      <Box>
        <Text bold color={isUser ? 'blue' : 'green'}>
          {isUser ? '→' : '←'} {displayName}
        </Text>
        {timestamp && (
          <Text dimColor> • {timestamp}</Text>
        )}
      </Box>

      {/* Message parts */}
      <Box paddingLeft={2} paddingY={0} flexDirection="column">
        {message.parts.map((part, partIndex) => {
          // Determine if this part should be streaming (last part of streaming message)
          const isLastPart = partIndex === message.parts.length - 1;
          const shouldStreamThisPart = isStreaming && isLastPart;

          // Text part
          if (isTextPart(part)) {
            return (
              <TextPart
                key={`${message.id}-text-${partIndex}`}
                text={part.text}
                isStreaming={shouldStreamThisPart}
              />
            );
          }

          // Tool part (run_coding_tool)
          if (isToolPart(part) && isRunCodingToolPart(part)) {
            return (
              <ToolPart
                key={`${message.id}-tool-${partIndex}`}
                toolPart={part}
              />
            );
          }

          // Unknown part type (should not happen)
          return null;
        })}
      </Box>
    </Box>
  );
}

/**
 * Helper: Get display name for agent
 */
function getAgentDisplayName(agentType: string): string {
  switch (agentType) {
    case 'deus':
      return 'Deus';
    case 'claude-code':
      return 'Claude Code';
    case 'codex':
      return 'Codex';
    default:
      return 'Assistant';
  }
}
