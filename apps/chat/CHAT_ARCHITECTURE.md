# Chat Architecture & Integration Plan

## Core Architecture from submodules/chat (Optimized for SSR & Speed)

```mermaid
graph TB
    subgraph "Page Layer (Server Components)"
        Page[page.tsx - RSC with PPR]
        Page --> ChatLayout[ChatLayout - Server Component]
        Page --> ChatInterface[ChatInterface - Client Boundary]
    end

    subgraph "Layout Layer (Partial Prerendering)"
        ChatLayout --> Sidebar[ServerSidebarImplementation - Suspense]
        ChatLayout --> Header[AuthenticatedHeader]
    end

    subgraph "Chat Interface (Client Components)"
        ChatInterface --> ChatMessages[ChatMessages - Streaming UI]
        ChatInterface --> ChatInput[ChatInput - Optimistic Updates]
        ChatInterface --> SimpleChatStart[SimpleChatStart - Empty State]
    end

    subgraph "Hooks Layer (State Management)"
        ChatInterface --> useChat[useChat Hook]
        useChat --> useChatTransport[useChatTransport - Streaming]
        useChat --> useCreateThread[useCreateThread - Optimistic]
        useChat --> useCreateMessage[useCreateMessage - Optimistic]
    end

    subgraph "Data Layer"
        useChat --> ConvexDB[(Convex DB)]
        useChatTransport --> VercelAI[Vercel AI SDK]
        VercelAI --> StreamingAPI[/api/chat/stream]
    end
```

## Key Optimizations from submodules/chat

### 1. **Server-Side Rendering with PPR (Partial Prerendering)**
- Server components for initial render (ChatLayout, ServerSidebarImplementation)
- Client components only where needed (ChatInterface, ChatInput)
- Suspense boundaries for progressive enhancement
- Preloaded queries for instant data availability

### 2. **Streaming Architecture**
- Custom transport layer (`useChatTransport`) for real-time streaming
- Vercel AI SDK integration with optimistic updates
- Message parts streaming for smooth UX
- Automatic reconnection and error recovery

### 3. **Database Integration (Convex)**
- Real-time sync with optimistic updates
- Efficient query patterns with preloading
- Client-side ID generation for instant feedback
- Server-side validation and persistence

### 4. **Component Architecture**
```
ChatLayout (Server)
├── Sidebar (Server + Suspense)
├── Header (Server + Suspense)
└── ChatInterface (Client Boundary)
    ├── ChatMessages (Client - Streaming)
    ├── ChatInput (Client - Optimistic)
    └── EmptyState (Client - Interactive)
```

## Integration Plan for apps/chat

### Phase 1: Unauthenticated Chat (Streaming, No Persistence)

```typescript
// Structure for unauthenticated chat
interface UnauthenticatedChat {
  messages: Message[]  // In-memory only (sessionStorage)
  transport: 'direct-streaming'  // Direct streaming API, no Convex
  persistence: false  // No DB storage
  streaming: true  // Full streaming support
}
```

**Implementation:**
1. **Landing Page (`/`)**
   - Use `SimpleChatStart` pattern for empty state
   - `ChatInput` with immediate streaming response
   - `ChatMessages` for displaying streamed responses
   - Session-based conversation (lost on refresh)

2. **State Management**
   ```typescript
   // Full streaming useChat for unauthenticated
   export function useUnauthenticatedChat() {
     const [messages, setMessages] = useState<Message[]>([])
     
     const sendMessage = async (content: string) => {
       // Add user message
       const userMessage = { role: 'user', content, id: nanoid() }
       setMessages(prev => [...prev, userMessage])
       
       // Stream assistant response
       const response = await fetch('/api/chat/stream', {
         method: 'POST',
         body: JSON.stringify({ 
           messages: [...messages, userMessage],
           // No auth token needed for unauthenticated
         })
       })
       
       // Handle streaming response
       const reader = response.body?.getReader()
       // ... streaming implementation
     }
     
     return { messages, sendMessage, isStreaming }
   }
   ```

3. **Streaming Transport**
   ```typescript
   // Unauthenticated streaming transport
   export function useUnauthenticatedTransport() {
     return {
       async *stream(messages: Message[]) {
         const response = await fetch('/api/chat/stream', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             messages,
             // Use default model for unauthenticated
             model: DEFAULT_MODEL_ID
           }),
         })
         
         // Parse streaming response
         yield* parseStreamResponse(response)
       }
     }
   }
   ```

### Phase 2: Authenticated Chat (With Persistence)

```typescript
// Structure for authenticated chat
interface AuthenticatedChat {
  messages: Message[]  // Persisted in vendor/db
  transport: 'convex-http'  // Through Convex HTTP actions
  persistence: true
  optimistic: true  // Optimistic updates
}
```

**Implementation:**
1. **New Chat (`/chat/new`)**
   - Server component with auth check
   - Preload user settings
   - Use full `useChat` hook with Convex integration

2. **Thread View (`/chat/[threadId]`)**
   - Server-side data fetching with RSC
   - Streaming messages with `ChatMessages` component
   - Real-time updates via Convex subscriptions

### Component Reuse Map (Simplified)

| Component | Unauthenticated | Authenticated | Purpose |
|-----------|----------------|---------------|---------|
| `ChatInput` | ✅ | ✅ | Message input |
| `ChatMessages` | ✅ | ✅ | Streaming display |
| `AppEmptyState` | ✅ | ✅ | Initial state |
| `AppHeader` | ✅ | ❌ | Unauth navigation |
| `AuthenticatedHeader` | ❌ | ✅ | Auth navigation |
| `Sidebar` | ❌ | ✅ | Thread list |

### Database Integration - Vercel AI Chatbot Schema

Using the same schema as Vercel AI Chatbot with Drizzle ORM and PostgreSQL:

```typescript
import { pgTable, varchar, timestamp, json, uuid, text } from 'drizzle-orm/pg-core';

// User table
export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }), // Optional for OAuth
});

// Chat (Thread) table
export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

// Messages table (v2 with parts structure)
export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(), // 'user' | 'assistant' | 'system'
  parts: json('parts').notNull(),  // Message parts for streaming
  attachments: json('attachments').notNull(), // File attachments
  createdAt: timestamp('createdAt').notNull(),
});
```

### Key Schema Features:
1. **UUID IDs** - Auto-generated, better for distributed systems
2. **Parts-based messages** - Supports streaming and tool calls
3. **Attachments field** - For file/image support
4. **Visibility field** - For future sharing features (private by default)

### Message Parts Structure:
```typescript
// Message parts allow for streaming and tool calls
type MessagePart = 
  | { type: 'text', text: string }
  | { type: 'tool-call', toolName: string, args: any, result?: any }
  | { type: 'image', url: string }
  | { type: 'file', url: string, name: string }

// Example message.parts field:
{
  parts: [
    { type: 'text', text: 'Let me search for that...' },
    { type: 'tool-call', toolName: 'search', args: { query: 'AI news' }, result: [...] },
    { type: 'text', text: 'Based on my search, here are the results...' }
  ]
}
```

### Streaming Transport Layer

```typescript
// Adapt useChatTransport for our API
export function useChatTransport({ authToken, model }) {
  return {
    async *stream(messages: Message[]) {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, model }),
      })
      
      // Stream parsing logic
      const reader = response.body?.getReader()
      // ... streaming implementation
    }
  }
}
```

## Performance Optimizations to Implement

1. **Preloading & Prefetching**
   - Preload user settings in layout
   - Prefetch common models/prompts
   - Cache thread list aggressively

2. **Optimistic Updates**
   - Instant message appearance
   - Rollback on error
   - Conflict resolution

3. **Progressive Enhancement**
   - SSR for SEO and initial load
   - Hydrate with minimal JS
   - Lazy load heavy components

4. **Bundle Optimization**
   - Dynamic imports for chat features
   - Tree-shake unused UI components
   - Minimize client bundle

## Implementation Steps with Vercel AI Schema

### Phase 1: Database Setup
- [ ] Set up PostgreSQL with Drizzle ORM
- [ ] Create migration files for User, Chat, Message_v2 tables
- [ ] Configure database connection with vendor/db

### Phase 2: Core Chat Hooks
- [ ] Implement `useChat` hook for both auth states
- [ ] Create streaming transport layer
- [ ] Handle message parts structure

### Phase 3: Unauthenticated Flow
- [ ] Landing page with streaming chat
- [ ] In-memory message storage
- [ ] Redirect to auth for persistence

### Phase 4: Authenticated Flow  
- [ ] User authentication with Clerk
- [ ] Chat/thread creation and persistence
- [ ] Message streaming with DB saves
- [ ] Thread list in sidebar

### Phase 5: Polish
- [ ] Optimistic updates
- [ ] Error handling
- [ ] Loading states

## Key Files to Reference from submodules/chat

1. **Core Components:**
   - `/components/chat/chat-interface.tsx` - Main chat orchestrator
   - `/components/chat/chat-messages.tsx` - Message display with streaming
   - `/components/chat/chat-input.tsx` - Input with optimistic updates

2. **Hooks:**
   - `/hooks/use-chat.ts` - Main chat logic
   - `/hooks/use-chat-transport.ts` - Streaming transport
   - `/hooks/use-create-thread-with-first-messages.ts` - Optimistic thread creation

3. **Server Components:**
   - `/components/chat/chat-layout.tsx` - PPR layout pattern
   - `/app/chat/[clientId]/page.tsx` - RSC with preloading

4. **Convex Integration:**
   - `/convex/messages.ts` - Message operations
   - `/convex/threads.ts` - Thread management
   - `/convex/http.ts` - HTTP actions for streaming

## Architecture Decisions

1. **Why Convex?**
   - Real-time subscriptions out of the box
   - Optimistic updates with automatic rollback
   - Type-safe from DB to UI
   - Built-in auth integration

2. **Why Vercel AI SDK?**
   - Streaming support with backpressure
   - Provider agnostic (OpenAI, Anthropic, etc.)
   - React hooks for easy integration
   - Automatic error recovery

3. **Why Server Components?**
   - Better SEO and initial load
   - Reduced client bundle
   - Direct database access
   - Progressive enhancement

4. **Why Client ID Pattern?**
   - Instant feedback (no server round-trip)
   - Works offline temporarily
   - Enables optimistic updates
   - Simplifies conflict resolution

## Summary: Unauthenticated vs Authenticated Chat

### **Key Differences**:
| Feature | Unauthenticated | Authenticated |
|---------|----------------|---------------|
| **Persistence** | ❌ None (session only) | ✅ vendor/db |
| **Streaming** | ✅ Direct API streaming | ✅ API streaming + DB save |
| **Layout** | Simple header (AppHeader) | Sidebar + AuthenticatedHeader |
| **State** | In-memory only | Real-time sync with DB |
| **History** | Lost on refresh | Persisted across sessions |
| **Thread management** | ❌ Single session | ✅ Multiple threads |

### **What Both Modes Share**:
- ✅ Full streaming support for real-time responses
- ✅ Same ChatInput component for message entry
- ✅ Same ChatMessages component for display
- ✅ Optimistic UI updates for better UX
- ✅ Same AI models and API endpoints
- ✅ Error handling and retry logic