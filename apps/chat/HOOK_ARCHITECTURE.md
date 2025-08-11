# Chat Hook Architecture Decision

## Option 1: Separate Hooks (useUnauthenticatedChat & useAuthenticatedChat)

### Pros:
- **Clear separation of concerns** - Each hook handles its specific logic
- **Smaller bundle size** - Unauthenticated pages don't load auth logic
- **Type safety** - Each hook can have different return types
- **Easier testing** - Test each flow independently
- **No conditional logic** - Cleaner code without auth checks

### Cons:
- **Code duplication** - Streaming logic, error handling repeated
- **Maintenance burden** - Fix bugs in two places
- **Transition complexity** - Harder to preserve state when user signs in

### Implementation:
```typescript
// hooks/use-unauthenticated-chat.ts
export function useUnauthenticatedChat() {
  const [messages, setMessages] = useState<Message[]>([])
  
  const sendMessage = async (content: string) => {
    // Direct streaming, no DB
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [...messages, { role: 'user', content }] })
    })
    // Handle streaming...
  }
  
  return { messages, sendMessage, isStreaming }
}

// hooks/use-authenticated-chat.ts  
export function useAuthenticatedChat({ chatId }: { chatId: string }) {
  const { userId } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  
  const sendMessage = async (content: string) => {
    // Save to DB, then stream
    await saveMessageToDB({ chatId, content, userId })
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, chatId })
    })
    // Handle streaming...
  }
  
  return { messages, sendMessage, isStreaming, threads }
}
```

## Option 2: Unified Hook with Auth Detection (useChat)

### Pros:
- **Single source of truth** - All chat logic in one place
- **Easier maintenance** - Fix bugs once
- **Smooth transition** - Can preserve messages when user signs in
- **Shared utilities** - Streaming, error handling, retry logic shared
- **Progressive enhancement** - Same hook works for both states

### Cons:
- **Larger bundle** - Auth logic loaded even when not needed
- **Complex conditionals** - if/else branches for auth state
- **Testing complexity** - Need to test both paths
- **Type complexity** - Return type varies based on auth state

### Implementation:
```typescript
// hooks/use-chat.ts
export function useChat({ chatId }: { chatId?: string } = {}) {
  const { userId, isSignedIn } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  
  // Load from DB if authenticated
  useEffect(() => {
    if (isSignedIn && chatId) {
      loadMessagesFromDB(chatId).then(setMessages)
    }
  }, [isSignedIn, chatId])
  
  const sendMessage = async (content: string) => {
    const userMessage = { role: 'user', content, id: uuidv4() }
    setMessages(prev => [...prev, userMessage])
    
    // Save to DB if authenticated
    if (isSignedIn && chatId) {
      await saveMessageToDB({ chatId, ...userMessage, userId })
    }
    
    // Stream response (same for both)
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: isSignedIn ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ 
        messages: [...messages, userMessage],
        chatId: isSignedIn ? chatId : undefined 
      })
    })
    
    // Handle streaming (shared logic)...
  }
  
  return { 
    messages, 
    sendMessage, 
    isStreaming,
    // Only for authenticated
    ...(isSignedIn && { threads, createNewChat, deleteChat })
  }
}
```

## Recommendation: Separate Hooks with Shared Utilities ✅

Based on your architecture and the clear separation between authenticated and unauthenticated flows, I recommend **separate hooks** with a shared streaming utility:

```typescript
// hooks/use-streaming.ts (Shared)
export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false)
  
  const streamResponse = async function* (response: Response) {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      yield chunk
    }
  }
  
  return { streamResponse, isStreaming, setIsStreaming }
}

// hooks/use-unauthenticated-chat.ts
export function useUnauthenticatedChat() {
  const { streamResponse, isStreaming, setIsStreaming } = useStreaming()
  const [messages, setMessages] = useState<Message[]>([])
  
  const sendMessage = async (content: string) => {
    setIsStreaming(true)
    // Add user message
    const userMessage = { role: 'user' as const, content, id: uuidv4() }
    setMessages(prev => [...prev, userMessage])
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: [...messages, userMessage] })
      })
      
      // Stream assistant message
      const assistantMessage = { role: 'assistant' as const, content: '', id: uuidv4() }
      setMessages(prev => [...prev, assistantMessage])
      
      for await (const chunk of streamResponse(response)) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1].content += chunk
          return updated
        })
      }
    } finally {
      setIsStreaming(false)
    }
  }
  
  return { messages, sendMessage, isStreaming }
}

// hooks/use-authenticated-chat.ts
export function useAuthenticatedChat({ chatId }: { chatId: string }) {
  const { streamResponse, isStreaming, setIsStreaming } = useStreaming()
  const { userId, token } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  
  // Load messages from DB
  useEffect(() => {
    if (chatId) {
      loadChatMessages(chatId).then(setMessages)
    }
  }, [chatId])
  
  const sendMessage = async (content: string) => {
    setIsStreaming(true)
    const userMessage = { 
      role: 'user' as const, 
      content, 
      id: uuidv4(),
      chatId,
      userId 
    }
    
    // Optimistic update
    setMessages(prev => [...prev, userMessage])
    
    try {
      // Save to DB
      await db.insert(message).values({
        chatId,
        role: 'user',
        parts: [{ type: 'text', text: content }],
        attachments: [],
        createdAt: new Date()
      })
      
      // Stream response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages, chatId })
      })
      
      const assistantMessage = { 
        role: 'assistant' as const, 
        content: '', 
        id: uuidv4(),
        chatId 
      }
      setMessages(prev => [...prev, assistantMessage])
      
      let fullContent = ''
      for await (const chunk of streamResponse(response)) {
        fullContent += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1].content = fullContent
          return updated
        })
      }
      
      // Save assistant message to DB
      await db.insert(message).values({
        chatId,
        role: 'assistant',
        parts: [{ type: 'text', text: fullContent }],
        attachments: [],
        createdAt: new Date()
      })
    } finally {
      setIsStreaming(false)
    }
  }
  
  return { 
    messages, 
    sendMessage, 
    isStreaming,
    threads: useThreads(userId),
    createNewChat: useCreateChat(userId),
    deleteChat: useDeleteChat()
  }
}
```

## Why Separate Hooks?

1. **Clear boundaries** - `/` uses `useUnauthenticatedChat`, `/chat/*` uses `useAuthenticatedChat`
2. **Better performance** - Unauthenticated users don't load DB logic
3. **Easier to reason about** - No complex conditionals
4. **Type safety** - Each hook has predictable return types
5. **Shared streaming** - Still avoid duplication with `useStreaming` utility

## Usage:

```typescript
// Landing page (/)
export default function LandingPage() {
  const { messages, sendMessage, isStreaming } = useUnauthenticatedChat()
  
  return (
    <>
      <ChatMessages messages={messages} />
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </>
  )
}

// Authenticated chat (/chat/[threadId])
export default function ChatPage({ params: { threadId } }) {
  const { messages, sendMessage, isStreaming, threads } = useAuthenticatedChat({ 
    chatId: threadId 
  })
  
  return (
    <>
      <Sidebar threads={threads} />
      <ChatMessages messages={messages} />
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </>
  )
}
```

This approach gives you the best of both worlds: clean separation with shared utilities!