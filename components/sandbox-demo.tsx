'use client';

import { Code, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function SandboxDemo() {
  const [code, setCode] = useState(`// Try running some JavaScript code!
console.log("Hello from Vercel Sandbox!");

const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled numbers:", doubled);

// You can also use Node.js APIs
const os = require('os');
console.log("Platform:", os.platform());`);

  const [language, setLanguage] = useState('javascript');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleExecute = async () => {
    setIsLoading(true);
    setResult('');
    setError('');

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // In a real app, you'd poll for the result or use webhooks
        // For demo purposes, we'll simulate the result
        setTimeout(() => {
          setResult('Code executed successfully! Check the Inngest dashboard for results.');
          setIsLoading(false);
        }, 2000);
      } else {
        setError(data.error || 'Failed to execute code');
        setIsLoading(false);
      }
    } catch (_err) {
      setError('Failed to send execution request');
      setIsLoading(false);
    }
  };

  const bashExample = `#!/bin/bash
# Try running some bash commands!
echo "Hello from Vercel Sandbox!"

# List files
ls -la

# Show system info
uname -a

# Create and read a file
echo "Testing file operations" > test.txt
cat test.txt`;

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <CardTitle>Vercel Sandbox Execution</CardTitle>
        </div>
        <CardDescription>
          Execute code securely in an isolated sandbox environment powered by Inngest and Vercel
          Sandbox
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="language">Language</Label>
            <Select
              value={language}
              onValueChange={(value: string) => {
                setLanguage(value);
                if (value === 'bash') {
                  setCode(bashExample);
                } else {
                  setCode(`// Try running some JavaScript code!
console.log("Hello from Vercel Sandbox!");

const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled numbers:", doubled);

// You can also use Node.js APIs
const os = require('os');
console.log("Platform:", os.platform());`);
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="bash">Bash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter your code here..."
            className="min-h-[300px] font-mono text-sm"
          />
        </div>

        <Button onClick={handleExecute} disabled={isLoading || !code.trim()} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Execute Code
            </>
          )}
        </Button>

        {result && (
          <div className="rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <p className="text-sm">{result}</p>
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
