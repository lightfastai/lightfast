'use client';

import { BugReporter } from '@/components/bug-reporter';
import { SSEDebugPanel } from '@/components/sse-debug-panel';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';

export default function BugReporterPage() {
  const [showDebug, setShowDebug] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">AI-Powered Bug Reporter</h1>
            <p className="text-muted-foreground">
              Submit bug reports and get comprehensive analysis with security checks, root cause identification,
              and automated fix suggestions powered by AgentKit's multi-agent network.
            </p>
            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span>Bug Analysis Agent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>Security Analysis Agent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>Code Fix Agent</span>
              </div>
            </div>
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
            <BugReporter onChatIdChange={setCurrentChatId} />
          </div>
          {showDebug && (
            <div>
              <SSEDebugPanel chatId={currentChatId} show={showDebug} />
            </div>
          )}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Powered by Inngest AgentKit with Claude 3.7 Sonnet. The multi-agent network analyzes bugs,
            identifies security vulnerabilities, and suggests TypeScript-safe fixes.
          </p>
        </div>
      </div>
    </main>
  );
}