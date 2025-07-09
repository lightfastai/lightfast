'use client';

import { InvestigationChat } from '@/components/investigation-chat';
import { SSEDebugPanel } from '@/components/sse-debug-panel';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';

export default function InvestigationPage() {
  const [showDebug, setShowDebug] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">Code Investigation Agent Network</h1>
            <p className="text-muted-foreground">
              Investigate any GitHub repository using AI-powered agents that generate and execute bash
              scripts in isolated Vercel Sandboxes to analyze code structure, dependencies, and
              patterns.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="ml-4"
          >
            <Bug className="h-4 w-4 mr-2" />
            {showDebug ? 'Hide' : 'Show'} Debug
          </Button>
        </div>

        <div className={showDebug ? 'grid gap-6 lg:grid-cols-2' : ''}>
          <div>
            <InvestigationChat onChatIdChange={setCurrentChatId} />
          </div>
          {showDebug && (
            <div>
              <SSEDebugPanel chatId={currentChatId} show={showDebug} />
            </div>
          )}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            This demo uses Inngest for orchestration, Claude 3.7 Sonnet via Vercel AI Gateway for script generation, 
            and Vercel Sandbox for secure code execution. {showDebug && 'Debug panel shows all SSE events in real-time.'}
          </p>
        </div>
      </div>
    </main>
  );
}