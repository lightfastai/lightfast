'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageAvatar, MessageContent } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { Loader } from '@/components/ai-elements/loader';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function AIElementsChat() {
  const [sessionId] = useState(() => uuidv4());
  
  // Create transport for the chat using the new fetchHandler API
  const transport = useMemo(() => {
    // Use the /api/chat/{sessionId} pattern
    const apiPath = `/api/chat/${sessionId}`;
    
    return new DefaultChatTransport({
      api: apiPath,
      headers: {
        'Content-Type': 'application/json',
      },
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
        return {
          api,
          headers,
          body: {
            messages,
            ...body,
          },
        };
      },
    });
  }, [sessionId]);
  
  const { messages, sendMessage, status, input, handleInputChange, handleSubmit } = useChat({
    transport,
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">Lightfast AI Elements Chat</h1>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-1 bg-secondary rounded" title="Session ID for memory persistence">
              Session: {sessionId.slice(0, 8)}...
            </span>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
              <Bot className="w-12 h-12 mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium mb-2">Start a conversation</p>
              <p className="text-sm text-center max-w-md">
                Powered by Vercel AI Elements with Lightfast Core for agent orchestration
              </p>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-left max-w-2xl">
                <div className="p-3 bg-secondary rounded-lg">
                  <h3 className="font-semibold text-foreground mb-1">🎨 AI Elements</h3>
                  <p className="text-xs">Beautiful, composable UI components for AI chat</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <h3 className="font-semibold text-foreground mb-1">💾 Memory</h3>
                  <p className="text-xs">Redis-backed conversation persistence</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <h3 className="font-semibold text-foreground mb-1">🤖 Agent System</h3>
                  <p className="text-xs">Structured agents with telemetry and error handling</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap">
                        {(message as any).parts?.[0]?.text || message.content}
                      </p>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>
                          {(message as any).parts?.[0]?.text || message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </MessageContent>
                  <MessageAvatar 
                    src={message.role === 'user' ? '' : ''} 
                    name={message.role === 'user' ? 'You' : 'AI'}
                  />
                </Message>
              ))}
              
              {/* Loading indicator */}
              {(status === 'streaming' || status === 'submitted') && (
                <Message from="assistant">
                  <MessageContent>
                    <Loader type="dots" />
                  </MessageContent>
                  <MessageAvatar src="" name="AI" />
                </Message>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input */}
      <div className="border-t bg-background p-4">
        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea 
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={status === 'streaming' || status === 'submitted'}
          />
          <PromptInputToolbar>
            <PromptInputTools>
              {/* Add any tool buttons here if needed */}
            </PromptInputTools>
            <PromptInputSubmit status={status} />
          </PromptInputToolbar>
        </PromptInput>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Powered by Vercel AI Elements • Lightfast Core • Session persisted with Redis
        </p>
      </div>
    </div>
  );
}