import * as React from 'react';
import { Box, useInput, useApp } from 'ink';
import { AgentPanel } from './agent-panel.js';
import { InputBar } from './input-bar.js';
import { StatusBar } from './status-bar.js';
import { Orchestrator } from '../lib/orchestrator.js';
import { type OrchestrationState } from '../types/index.js';

const { useState, useEffect } = React;

const orchestrator = new Orchestrator();

export const App: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<OrchestrationState>(orchestrator.getState());

  useEffect(() => {
    // Subscribe to orchestrator state changes
    const unsubscribe = orchestrator.subscribe((newState) => {
      setState(newState);
    });

    // Initialize agents
    orchestrator.startAgent('claude-code').catch(console.error);
    orchestrator.startAgent('codex').catch(console.error);

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
    orchestrator.switchAgent();
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Status Bar */}
      <StatusBar state={state} />

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
