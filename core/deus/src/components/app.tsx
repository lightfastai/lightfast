/**
 * Deus v2.0 - Simple Mode App
 * Single-agent view with Deus as smart router
 */

import * as React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { InputBar } from './input-bar.js';
import { StatusBar } from './status-bar.js';
import { WelcomeScreen } from './welcome-screen.js';
import { MessageList } from './message-list.js';
import { ApprovalPrompt } from './approval-prompt.js';
import { Orchestrator, type ActiveAgent, type AgentMessage } from '../lib/orchestrator.js';
import { logger } from '../lib/utils/logger.js';

const { useState, useEffect, useRef } = React;

export const App: React.FC = () => {
  const { exit } = useApp();
  const [orchestrator, setOrchestrator] = useState<Orchestrator | null>(null);
  const [state, setState] = useState<ReturnType<Orchestrator['getState']> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize orchestrator
  useEffect(() => {
    const init = async () => {
      const orch = new Orchestrator();
      await orch.initialize();
      setOrchestrator(orch);
      setState(orch.getState());
    };

    init();

    return () => {
      if (orchestrator) {
        orchestrator.cleanup();
      }
    };
  }, []);

  // Subscribe to orchestrator updates
  useEffect(() => {
    if (!orchestrator) return;

    const unsubscribe = orchestrator.subscribe((newState) => {
      // Debug: Log when state updates include pending approval
      if (newState.pendingApproval) {
        logger.debug('[App] Received state with pending approval', {
          promptPreview: newState.pendingApproval.prompt.slice(0, 50),
          hasApproval: !!newState.pendingApproval,
        });
      }

      setState(newState);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [orchestrator]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (!orchestrator) return;

    // If there's a pending approval, don't process other shortcuts
    // The ApprovalPrompt component will handle input
    if (state?.pendingApproval) {
      return;
    }

    // Exit on Ctrl+C
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    // Return to Deus on Ctrl+B
    if (key.ctrl && input === 'b') {
      orchestrator.handbackToDeus();
      return;
    }
  });

  // Handle message submission
  const handleSubmit = async (value: string) => {
    if (!orchestrator || !value.trim()) return;

    setIsLoading(true);

    try {
      await orchestrator.handleUserMessage(value);
    } catch (error) {
      console.error('[App] Error handling message:', error);
      setIsLoading(false);
    }
  };

  // Show loading state
  if (!orchestrator || !state) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Initializing Deus...</Text>
      </Box>
    );
  }

  // Get messages for current agent
  const messages = orchestrator.getMessagesForAgent(state.activeAgent);

  // Check if there's a pending approval
  const hasPendingApproval = state.pendingApproval !== null;

  // Debug: Log render state
  if (hasPendingApproval) {
    logger.debug('[App] Rendering with pending approval', {
      hasPendingApproval,
      promptPreview: state.pendingApproval?.prompt.slice(0, 50),
    });
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Status Bar */}
      <StatusBar
        activeAgent={state.activeAgent}
        sessionId={state.sessionId}
        jobType={state.jobType}
      />

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        <Messages
          messages={messages}
          uiMessages={state.uiMessages}
          activeAgent={state.activeAgent}
          isLoading={isLoading}
        />

        {/* Approval Prompt (if pending) */}
        {hasPendingApproval && state.pendingApproval && (
          <ApprovalPrompt
            approval={state.pendingApproval}
            onApprove={() => orchestrator.handleApprovalResponse(true)}
            onReject={() => orchestrator.handleApprovalResponse(false)}
            isFocused={true}
          />
        )}
      </Box>

      {/* Input Bar - disabled when approval is pending */}
      <InputBar
        activeAgent={state.activeAgent}
        onSubmit={handleSubmit}
        isFocused={!isLoading && !hasPendingApproval}
        isLoading={isLoading}
      />
    </Box>
  );
};

/**
 * Messages Component
 * Conditionally renders UIMessages for Deus or legacy messages for Claude/Codex
 */
function Messages({
  messages,
  uiMessages,
  activeAgent,
  isLoading,
}: {
  messages: AgentMessage[];
  uiMessages: ReturnType<Orchestrator['getState']>['uiMessages'];
  activeAgent: ActiveAgent;
  isLoading: boolean;
}) {
  // For Deus: use new UIMessage format if available
  if (activeAgent === 'deus' && uiMessages.length > 0) {
    return <MessageList messages={uiMessages} isStreaming={isLoading} />;
  }

  // For Claude/Codex or when no UIMessages: use legacy format
  if (messages.length === 0) {
    return <WelcomeScreen activeAgent={activeAgent} />;
  }

  return (
    <Box flexDirection="column">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </Box>
  );
}

/**
 * Message Bubble Component
 */
function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <Box paddingY={0} paddingX={1}>
        <Text dimColor italic>
          ℹ {message.content}
        </Text>
      </Box>
    );
  }

  return (
    <Box paddingY={0} paddingX={2} marginY={0}>
      <Box flexDirection="column" width="100%">
        {/* Role indicator */}
        <Box>
          <Text bold color={isUser ? 'blue' : 'green'}>
            {isUser ? '→ You' : `← ${getAgentName(message.agent)}`}
          </Text>
          <Text dimColor> • {formatTime(message.timestamp)}</Text>
        </Box>

        {/* Message content */}
        <Box paddingLeft={2} paddingY={0}>
          <Text>{message.content}</Text>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Helper: Get agent name
 */
function getAgentName(agent: ActiveAgent): string {
  switch (agent) {
    case 'deus':
      return 'Deus';
    case 'claude-code':
      return 'Claude Code';
    case 'codex':
      return 'Codex';
  }
}

/**
 * Helper: Format timestamp
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
