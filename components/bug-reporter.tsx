'use client';

import { AlertCircle, Bug, FileCode, Loader2, Send, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ApiResponse } from '@/types/inngest';
import type { BugReport } from '@/lib/agent-kit/types';

interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'info' | 'success' | 'error' | 'result';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface BugReporterProps {
  onChatIdChange?: (chatId: string | null) => void;
}

export function BugReporter({ onChatIdChange }: BugReporterProps = {}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repository, setRepository] = useState('https://github.com/vercel/next.js');
  const [category, setCategory] = useState<BugReport['category']>('logic');
  const [severity, setSeverity] = useState<BugReport['severity']>('medium');
  const [filePath, setFilePath] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [stackTrace, setStackTrace] = useState('');
  
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notify parent when chatId changes
  useEffect(() => {
    onChatIdChange?.(chatId);
  }, [chatId, onChatIdChange]);

  // Set up SSE connection when chatId is available
  useEffect(() => {
    if (!chatId) return;

    setConnectionStatus('connecting');
    const eventSource = new EventSource(`/api/investigation/updates?chatId=${chatId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      console.log('Bug reporter SSE connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('Connected to bug reporter updates');
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
      setConnectionStatus('disconnected');
      setError('Lost connection to updates. Please refresh.');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setConnectionStatus('disconnected');
    };
  }, [chatId]);

  const submitBugReport = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Please provide at least a title and description');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Generate a unique bug ID
    const bugId = `bug_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      type: 'user',
      message: `🐛 Reporting bug: ${title}`,
      timestamp: new Date().toISOString(),
    };
    setMessages([userMessage]);

    try {
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bugReport: {
            id: bugId,
            title,
            description,
            repository,
            category,
            severity,
            filePath: filePath || undefined,
            lineNumber: lineNumber ? parseInt(lineNumber) : undefined,
            codeSnippet: codeSnippet || undefined,
            stackTrace: stackTrace || undefined,
          },
          repository,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit bug report');
      }

      if (data.data && typeof data.data === 'object' && 'chatId' in data.data) {
        setChatId(data.data.chatId as string);
      }
      
      // Clear form
      setTitle('');
      setDescription('');
      setCodeSnippet('');
      setStackTrace('');
      setFilePath('');
      setLineNumber('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bug report');
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          type: 'error',
          message: 'Failed to submit bug report. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const exampleBugs = [
    { title: 'Type assertion bypasses null check', category: 'type-safety' as const, severity: 'high' as const },
    { title: 'XSS vulnerability in user input', category: 'security' as const, severity: 'critical' as const },
    { title: 'Memory leak in event listeners', category: 'memory' as const, severity: 'medium' as const },
    { title: 'Race condition in async operations', category: 'logic' as const, severity: 'high' as const },
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Code Bug Reporter
          </CardTitle>
          {chatId && (
            <div className="flex items-center gap-2 text-sm">
              <div className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                'bg-red-500'
              }`} />
              <span className="text-muted-foreground">
                {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'connecting' ? 'Connecting...' : 
                 'Disconnected'}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Bug Title*</Label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Null pointer exception in user service"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="repository">Repository URL</Label>
            <input
              id="repository"
              type="url"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="https://github.com/username/repo"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as BugReport['category'])}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="security">🔒 Security</SelectItem>
                <SelectItem value="type-safety">📘 Type Safety</SelectItem>
                <SelectItem value="performance">⚡ Performance</SelectItem>
                <SelectItem value="logic">🧩 Logic Error</SelectItem>
                <SelectItem value="memory">💾 Memory Issue</SelectItem>
                <SelectItem value="other">📦 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Select value={severity} onValueChange={(value) => setSeverity(value as BugReport['severity'])}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">🔴 Critical</SelectItem>
                <SelectItem value="high">🟠 High</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Bug Description*</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the bug in detail..."
            rows={4}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="filePath">File Path (optional)</Label>
            <input
              id="filePath"
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="src/components/UserService.ts"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lineNumber">Line Number (optional)</Label>
            <input
              id="lineNumber"
              type="number"
              value={lineNumber}
              onChange={(e) => setLineNumber(e.target.value)}
              placeholder="42"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="codeSnippet">Code Snippet (optional)</Label>
          <Textarea
            id="codeSnippet"
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="Paste relevant code here..."
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stackTrace">Stack Trace (optional)</Label>
          <Textarea
            id="stackTrace"
            value={stackTrace}
            onChange={(e) => setStackTrace(e.target.value)}
            placeholder="Paste stack trace here..."
            rows={3}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Example Bugs</Label>
          <div className="flex flex-wrap gap-2">
            {exampleBugs.map((example) => (
              <button
                key={example.title}
                type="button"
                onClick={() => {
                  setTitle(example.title);
                  setCategory(example.category);
                  setSeverity(example.severity);
                  setDescription(`This is an example ${example.category} bug with ${example.severity} severity.`);
                }}
                className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              >
                {example.title}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Button
          onClick={submitBugReport}
          disabled={isLoading || !title.trim() || !description.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Bug...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Submit Bug Report
            </>
          )}
        </Button>

        {messages.length > 0 && (
          <div className="mt-6 space-y-2">
            <Label>Analysis Progress</Label>
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
                  {msg.metadata && Object.keys(msg.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer hover:underline">
                        View analysis details
                      </summary>
                      <pre className="mt-2 p-2 bg-black/10 rounded text-xs overflow-x-auto">
                        <code>{JSON.stringify(msg.metadata, null, 2)}</code>
                      </pre>
                    </details>
                  )}
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