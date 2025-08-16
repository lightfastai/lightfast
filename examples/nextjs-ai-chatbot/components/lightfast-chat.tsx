'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';
import { v4 as uuidv4 } from 'uuid';

export function LightfastChat() {
  const [sessionId] = useState(() => uuidv4());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [input, setInput] = useState('');
  const [error, setError] = useState<Error | null>(null);
  
  // Create transport for the chat
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: '/api/chat',
      headers: {
        'Content-Type': 'application/json',
      },
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
        return {
          api,
          headers,
          body: {
            messages,
            sessionId,
            ...body,
          },
        };
      },
    });
  }, [sessionId]);
  
  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (error) => {
      console.error('Chat error:', error);
      setError(error);
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const message = input;
    setInput('');
    
    await sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: message }],
      id: uuidv4(),
    });
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold">Lightfast Core Agent</h1>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="px-2 py-1 bg-gray-100 rounded" title="Session ID for memory persistence">
              Session: {sessionId.slice(0, 8)}...
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Bot className="w-12 h-12 mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">Start a conversation</p>
            <p className="text-sm text-center max-w-md">
              Powered by Lightfast Core v1 with agent orchestration, memory persistence, and tool support
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-1">🤖 Agent System</h3>
                <p className="text-xs text-gray-600">Structured agents with system prompts and versioning</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-1">💾 Memory</h3>
                <p className="text-xs text-gray-600">Redis-backed conversation persistence</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-1">🛠️ Tools</h3>
                <p className="text-xs text-gray-600">Extensible tool system for agent capabilities</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                
                <div
                  className={clsx(
                    'max-w-[70%] rounded-lg px-4 py-2',
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  )}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap">
                      {(message as any).parts?.[0]?.text || ''}
                    </p>
                  ) : (
                    <ReactMarkdown 
                      className="prose prose-sm max-w-none"
                      components={{
                        pre: ({ children }) => (
                          <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        code: ({ children, className }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-gray-200 px-1 py-0.5 rounded text-sm">
                              {children}
                            </code>
                          ) : (
                            <code>{children}</code>
                          );
                        },
                      }}
                    >
                      {(message as any).parts?.[0]?.text || ''}
                    </ReactMarkdown>
                  )}
                </div>
                
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                </div>
              </div>
            )}
            
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error.message}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Dismiss
                </button>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Send
          </button>
        </form>
        
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by Lightfast Core v1 • Session persisted with Redis
        </p>
      </div>
    </div>
  );
}