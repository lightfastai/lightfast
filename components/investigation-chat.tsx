'use client';

import { AlertCircle, Loader2, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApiResponse } from '@/types/inngest';

interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'info' | 'success' | 'error' | 'result';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function InvestigationChat() {
  const [repository, setRepository] = useState('https://github.com/get-convex/convex-js');
  const [query, setQuery] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set up SSE connection when chatId is available
  useEffect(() => {
    if (!chatId) return;

    const eventSource = new EventSource(`/api/investigation/updates?chatId=${chatId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('Connected to investigation updates');
          return;
        }

        const newMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: data.type || 'info',
          message: data.message,
          timestamp: data.timestamp || new Date().toISOString(),
          metadata: data.metadata,
        };

        setMessages((prev) => [...prev, newMessage]);
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setError('Lost connection to updates. Please refresh.');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [chatId]);

  const startInvestigation = async () => {
    if (!query.trim() || !repository.trim()) {
      setError('Please provide both a repository URL and a query');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      message: query,
      timestamp: new Date().toISOString(),
    };
    setMessages([userMessage]);

    try {
      const response = await fetch('/api/investigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, repository }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start investigation');
      }

      if (data.data && typeof data.data === 'object' && 'chatId' in data.data) {
        setChatId(data.data.chatId as string);
      }
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start investigation');
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          type: 'error',
          message: 'Failed to start investigation. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    'What is the main architecture of this repository?',
    'Find all API endpoints and their purposes',
    'What are the main dependencies and why are they used?',
    'Identify potential security vulnerabilities',
    'How is authentication handled in this codebase?',
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Code Investigation Agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="repository">Repository URL</Label>
          <input
            id="repository"
            type="url"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            placeholder="https://github.com/username/repo"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <Label>Example Queries</Label>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="query">Investigation Query</Label>
          <Textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you like to investigate about this repository?"
            rows={3}
            className="w-full"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Button
          onClick={startInvestigation}
          disabled={isLoading || !query.trim() || !repository.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting Investigation...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Start Investigation
            </>
          )}
        </Button>

        {messages.length > 0 && (
          <div className="mt-6 space-y-2">
            <Label>Investigation Progress</Label>
            <div className="border rounded-lg p-4 h-96 overflow-y-auto space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]'
                      : msg.type === 'error'
                        ? 'bg-destructive/10 border border-destructive/20'
                        : msg.type === 'success'
                          ? 'bg-green-500/10 border border-green-500/20'
                          : msg.type === 'result'
                            ? 'bg-blue-500/10 border border-blue-500/20'
                            : 'bg-muted'
                  }`}
                >
                  <div className="text-sm">{msg.message}</div>
                  {msg.metadata?.script && typeof msg.metadata.script === 'string' ? (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer hover:underline">
                        View generated script
                      </summary>
                      <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-x-auto">
                        <code>{msg.metadata.script}</code>
                      </pre>
                    </details>
                  ) : null}
                  {msg.metadata?.output && typeof msg.metadata.output === 'string' ? (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer hover:underline">
                        View output
                      </summary>
                      <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-x-auto">
                        <code>{msg.metadata.output}</code>
                      </pre>
                    </details>
                  ) : null}
                  <div className="text-xs opacity-50 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
