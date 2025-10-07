import * as React from 'react';
import { Box, useInput, useApp, Text } from 'ink';
import { AgentPanel } from './agent-panel.js';
import { InputBar } from './input-bar.js';
import { StatusBar } from './status-bar.js';
import { Orchestrator } from '../lib/orchestrator.js';
import { SessionManager } from '../lib/session-manager.js';
import { type OrchestrationState } from '../types/index.js';

const { useState, useEffect, useRef } = React;

export const App: React.FC = () => {
  const { exit } = useApp();
  const [isInitializing, setIsInitializing] = useState(true);

  // Create session manager and orchestrator in ref to persist across renders
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const orchestratorRef = useRef<Orchestrator | null>(null);

  // Initialize session manager first, then orchestrator
  if (!sessionManagerRef.current) {
    sessionManagerRef.current = new SessionManager();
  }

  if (!orchestratorRef.current && sessionManagerRef.current) {
    orchestratorRef.current = new Orchestrator(sessionManagerRef.current);
  }

  const orchestrator = orchestratorRef.current!;
  const sessionManager = sessionManagerRef.current!;

  const [state, setState] = useState<OrchestrationState>(orchestrator.getState());

  useEffect(() => {
    // Initialize session manager then start agents
    const initializeSession = async () => {
      try {
        // Initialize session (creates new or loads existing)
        await sessionManager.initialize();

        if (process.env.DEBUG) {
          console.log('[App] Session initialized:', sessionManager.getSessionId());
        }

        setIsInitializing(false);

        // Initialize agents - errors are already handled in orchestrator.startAgent
        // which updates the agent state and adds error messages to the UI
        orchestrator.startAgent('claude-code').catch((error) => {
          if (process.env.DEBUG) {
            console.error('[App] Failed to start claude-code:', error);
          }
        });

        orchestrator.startAgent('codex').catch((error) => {
          if (process.env.DEBUG) {
            console.error('[App] Failed to start codex:', error);
          }
        });
      } catch (error) {
        console.error('[App] Failed to initialize session:', error);
        setIsInitializing(false);
      }
    };

    // Subscribe to orchestrator state changes
    const unsubscribe = orchestrator.subscribe((newState) => {
      setState(newState);
    });

    initializeSession();

    return () => {
      unsubscribe();
      orchestrator.cleanup().catch(console.error);
    };
  }, []);

  useInput((input, key) => {
    // Only handle keyboard shortcuts, ignore regular input
    if (!key.ctrl && !key.meta) {
      return;
    }

    // Exit on Ctrl+C
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    // Share context on Ctrl+S
    if (key.ctrl && input === 's') {
      orchestrator.shareContext('last-interaction', {
        timestamp: new Date().toISOString(),
        agent: state.activeAgent,
      }).catch((error) => {
        if (process.env.DEBUG) {
          console.error('[App] Failed to share context:', error);
        }
      });
      return;
    }

    // Clear active agent on Ctrl+K
    if (key.ctrl && input === 'k') {
      orchestrator.clearAgent(state.activeAgent);
      return;
    }
  });

  const handleSubmit = (value: string) => {
    orchestrator.sendToAgent(state.activeAgent, value);
  };

  const handleSwitch = () => {
    orchestrator.switchAgent().catch((error) => {
      if (process.env.DEBUG) {
        console.error('[App] Failed to switch agent:', error);
      }
    });
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Initializing Deus session...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Status Bar */}
      <StatusBar state={state} deusSessionId={sessionManager.getSessionId()} />

      {/* Agent Panels */}
      <Box flexGrow={1} marginY={1}>
        <AgentPanel
          agent={state.claudeCode}
          isActive={state.activeAgent === 'claude-code'}
        />
        <AgentPanel agent={state.codex} isActive={state.activeAgent === 'codex'} />
      </Box>

      {/* Input Bar */}
      <InputBar
        activeAgent={state.activeAgent}
        onSubmit={handleSubmit}
        onSwitch={handleSwitch}
        isFocused={true}
      />
    </Box>
  );
};
