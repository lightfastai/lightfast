'use client';

import { Bot, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function AgentDemo() {
  const [query, setQuery] =
    useState(`Can you write a JavaScript function that calculates the factorial of a number? 
Test it with the numbers 5 and 10 to make sure it works correctly.`);

  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleQuery = async () => {
    setIsLoading(true);
    setResponse('');
    setError('');

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          context: {
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        // In a real app, you'd poll for the result or use webhooks
        // For demo purposes, we'll simulate the response
        setTimeout(() => {
          setResponse(
            'Agent is processing your request! Check the Inngest dashboard for the full response.',
          );
          setIsLoading(false);
        }, 2000);
      } else {
        setError(data.error || 'Failed to process query');
        setIsLoading(false);
      }
    } catch (_err) {
      setError('Failed to send query to agent');
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    'Write a JavaScript function that sorts an array of objects by a specific property',
    'Create a bash script that backs up a directory with timestamp',
    'Debug this code: const sum = arr.reduce((a, b) => a + b);',
    'Explain how async/await works in JavaScript with examples',
  ];

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <CardTitle>AI Coding Assistant</CardTitle>
        </div>
        <CardDescription>
          Ask the AI agent to help with coding tasks. It can write, test, and explain code using the
          Vercel Sandbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="query">Your Question</Label>
          <Textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask me anything about coding..."
            className="min-h-[150px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Example Queries</Label>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {exampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="text-left p-2 rounded-md hover:bg-muted transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleQuery} disabled={isLoading || !query.trim()} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Query
            </>
          )}
        </Button>

        {response && (
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            <p className="text-sm">{response}</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
