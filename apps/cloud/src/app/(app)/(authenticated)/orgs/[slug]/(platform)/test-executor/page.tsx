"use client";

import { useState, useRef } from "react";
import { Button } from "@repo/ui/components/ui/button";

interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
  memoryUsed?: number;
  logs?: string[];
}

interface StreamMessage {
  type: 'token' | 'complete' | 'error' | 'log' | 'metadata';
  content?: string;
  data?: any;
  timestamp?: string;
  error?: string;
}

export default function TestExecutorPage({
  params,
}: {
  params: { slug: string };
}) {
  const [bundleUrl, setBundleUrl] = useState("");
  const [agentInput, setAgentInput] = useState('{"message": "Hello, agent!"}');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [streamingMode, setStreamingMode] = useState(false);
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Sample test agent bundles for quick testing
  const sampleAgents = {
    simple: `
// Simple test agent
function simpleAgent(input) {
  console.log('Agent received input:', input);
  
  return {
    message: 'Hello from the agent!',
    receivedInput: input,
    timestamp: new Date().toISOString(),
    agentVersion: '1.0.0'
  };
}

exports.default = simpleAgent;`,

    streaming: `
// Streaming chat agent
function streamingAgent(input, streaming) {
  const { streamToken, streamComplete, streamError } = streaming || {};
  
  if (!streamToken) {
    // Fallback for non-streaming execution
    return 'This is a streaming agent. Please use /api/execute/stream endpoint.';
  }
  
  try {
    console.log('Starting streaming response...');
    
    const words = ['Hello', 'from', 'the', 'streaming', 'agent!', '🤖'];
    
    // Simulate streaming response
    let wordIndex = 0;
    const streamWord = () => {
      if (wordIndex < words.length) {
        streamToken(words[wordIndex] + ' ');
        wordIndex++;
        setTimeout(streamWord, 200); // 200ms delay between words
      } else {
        streamComplete();
      }
    };
    
    streamWord();
    
  } catch (error) {
    streamError('Failed to generate streaming response: ' + error.message);
  }
}

exports.default = streamingAgent;`,

    error: `
// Error test agent
function errorAgent(input) {
  console.log('This agent will throw an error');
  throw new Error('This is a test error from the agent');
}

exports.default = errorAgent;`
  };

  const executeAgent = async () => {
    if (!bundleUrl.trim()) {
      alert("Please enter a bundle URL");
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      let parsedInput;
      try {
        parsedInput = JSON.parse(agentInput);
      } catch {
        parsedInput = agentInput;
      }

      const response = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bundleUrl: bundleUrl,
          input: parsedInput,
          agentName: "test-agent",
          organizationId: params.slug,
          timeout: 10000,
          memoryLimit: 128,
        }),
      });

      const result: ExecutionResult = await response.json();
      setExecutionResult(result);

    } catch (error: any) {
      setExecutionResult({
        success: false,
        error: `Request failed: ${error.message}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const startStreaming = async () => {
    if (!bundleUrl.trim()) {
      alert("Please enter a bundle URL");
      return;
    }

    setIsStreaming(true);
    setStreamMessages([]);

    try {
      let parsedInput;
      try {
        parsedInput = JSON.parse(agentInput);
      } catch {
        parsedInput = agentInput;
      }

      const response = await fetch("/api/execute/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bundleUrl: bundleUrl,
          input: parsedInput,
          agentName: "streaming-test-agent",
          organizationId: params.slug,
          timeout: 30000,
          memoryLimit: 128,
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const message: StreamMessage = JSON.parse(line.slice(6));
              setStreamMessages(prev => [...prev, message]);
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }
    } catch (error: any) {
      setStreamMessages(prev => [...prev, {
        type: 'error',
        error: `Streaming failed: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  const loadSampleAgent = (type: keyof typeof sampleAgents) => {
    // Create a data URL for the sample agent
    const blob = new Blob([sampleAgents[type]], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    setBundleUrl(url);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Agent Executor Test</h1>
        <p className="text-muted-foreground">
          Test the secure agent execution system with isolated-vm sandboxing.
        </p>
      </div>

      {/* Sample Agents */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Quick Test Agents</h2>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => loadSampleAgent('simple')}
          >
            Load Simple Agent
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => loadSampleAgent('streaming')}
          >
            Load Streaming Agent
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => loadSampleAgent('error')}
          >
            Load Error Agent
          </Button>
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Bundle URL or Data URL
          </label>
          <input
            type="text"
            value={bundleUrl}
            onChange={(e) => setBundleUrl(e.target.value)}
            placeholder="https://example.com/agent-bundle.js or blob:// URL"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Agent Input (JSON or string)
          </label>
          <textarea
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            placeholder='{"message": "Hello, agent!"}'
            className="w-full px-3 py-2 border rounded-md h-24"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={streamingMode}
              onChange={(e) => setStreamingMode(e.target.checked)}
            />
            <span className="text-sm">Use streaming mode</span>
          </label>
        </div>
      </div>

      {/* Execution Controls */}
      <div className="flex gap-3 mb-6">
        {!streamingMode ? (
          <Button
            onClick={executeAgent}
            disabled={isExecuting}
            className="min-w-32"
          >
            {isExecuting ? "Executing..." : "Execute Agent"}
          </Button>
        ) : (
          <>
            <Button
              onClick={startStreaming}
              disabled={isStreaming}
              className="min-w-32"
            >
              {isStreaming ? "Streaming..." : "Start Streaming"}
            </Button>
            {isStreaming && (
              <Button
                onClick={stopStreaming}
                variant="outline"
              >
                Stop Stream
              </Button>
            )}
          </>
        )}
      </div>

      {/* Results */}
      {!streamingMode && executionResult && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Execution Result</h2>
          <div className={`p-4 rounded-md border ${
            executionResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="font-medium mb-2">
              Status: {executionResult.success ? '✅ Success' : '❌ Failed'}
            </div>
            
            {executionResult.executionTime && (
              <div className="text-sm text-muted-foreground mb-2">
                Execution Time: {executionResult.executionTime}ms
              </div>
            )}
            
            {executionResult.memoryUsed && (
              <div className="text-sm text-muted-foreground mb-2">
                Memory Used: {Math.round(executionResult.memoryUsed / 1024)}KB
              </div>
            )}

            {executionResult.error && (
              <div className="text-red-600 mb-2">
                Error: {executionResult.error}
              </div>
            )}

            {executionResult.result && (
              <div>
                <div className="font-medium mb-1">Result:</div>
                <pre className="text-sm bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(executionResult.result, null, 2)}
                </pre>
              </div>
            )}

            {executionResult.logs && executionResult.logs.length > 0 && (
              <div className="mt-3">
                <div className="font-medium mb-1">Logs:</div>
                <div className="text-sm bg-gray-100 p-2 rounded">
                  {executionResult.logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streaming Results */}
      {streamingMode && streamMessages.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Streaming Output</h2>
          <div className="border rounded-md p-4 bg-gray-50 max-h-96 overflow-y-auto">
            {streamMessages.map((message, i) => (
              <div key={i} className="mb-1">
                <span className="text-xs text-gray-500">
                  [{message.type}] {message.timestamp && new Date(message.timestamp).toLocaleTimeString()}:
                </span>
                <span className={`ml-2 ${
                  message.type === 'error' ? 'text-red-600' : 
                  message.type === 'token' ? 'text-green-600' : 
                  'text-gray-700'
                }`}>
                  {message.content || message.error || JSON.stringify(message.data)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documentation */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h3 className="font-medium mb-2">How to Use</h3>
        <ul className="text-sm space-y-1 text-blue-800">
          <li>1. Click "Load Simple Agent" to test basic execution</li>
          <li>2. Click "Load Streaming Agent" and enable streaming mode for real-time responses</li>
          <li>3. Or provide your own bundle URL from the deploy command</li>
          <li>4. Modify the input JSON to test different scenarios</li>
          <li>5. Check the results for execution time, memory usage, and logs</li>
        </ul>
        
        <div className="mt-3">
          <h4 className="font-medium mb-1">Security Features</h4>
          <ul className="text-sm space-y-1 text-blue-800">
            <li>• Complete V8 isolation using isolated-vm</li>
            <li>• Memory limits (128MB default)</li>
            <li>• Execution timeouts (10s standard, 30s streaming)</li>
            <li>• Safe console access with log capture</li>
            <li>• No network access or file system access</li>
          </ul>
        </div>
      </div>
    </div>
  );
}