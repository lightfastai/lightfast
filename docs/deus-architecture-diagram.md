# Deus Architecture & Data Flow

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Lightfast Ecosystem                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐                    ┌──────────────┐          │
│  │  apps/chat   │                    │  apps/deus   │          │
│  │  Port 4106   │                    │  Port 4107   │          │
│  │              │                    │              │          │
│  │ Standalone   │                    │  Web UI for  │          │
│  │ AI Chat      │                    │  Deus CLI    │          │
│  │              │    NO INTEGRATION  │              │          │
│  └──────────────┘                    └──────┬───────┘          │
│                                             │                   │
│                                             │ API               │
│                                             │ (tRPC + REST)     │
│                                             │                   │
│                                             v                   │
│                                      ┌──────────────┐           │
│                                      │  core/deus   │           │
│                                      │  CLI Tool    │           │
│                                      │              │           │
│                                      │ Orchestrates │           │
│                                      │ Claude Code  │           │
│                                      │ & Codex      │           │
│                                      └──────────────┘           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core/Deus ↔ Apps/Deus Integration

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Terminal                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ User commands
                             v
┌─────────────────────────────────────────────────────────────────────┐
│                     core/deus (CLI)                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Authentication          ┌──────────────────┐                   │
│  2. Session Management      │  SessionManager  │                   │
│  3. Message Routing         └────────┬─────────┘                   │
│  4. Agent Orchestration              │                             │
│  5. Offline Queue                    │                             │
│                                      │                             │
│  Components:                         │                             │
│  ┌──────────────────┐               │                             │
│  │ SessionSyncSvc   │───────────────┤                             │
│  └──────────────────┘               │                             │
│  ┌──────────────────┐               │                             │
│  │ Router           │───────────────┤                             │
│  └──────────────────┘               │                             │
│  ┌──────────────────┐               │                             │
│  │ API Client       │───────────────┘                             │
│  └──────────────────┘                                             │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP/JSON
                             │ Authorization: Bearer deus_sk_...
                             v
┌─────────────────────────────────────────────────────────────────────┐
│                     apps/deus (Web UI)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  API Routes:                                                        │
│  ┌──────────────────────────────────────────────────┐             │
│  │ POST /api/trpc/session.create                    │             │
│  │ POST /api/trpc/session.update                    │             │
│  │ POST /api/trpc/session.addMessage                │             │
│  │ GET  /api/trpc/session.list                      │             │
│  │ GET  /api/trpc/session.get                       │             │
│  │ GET  /api/trpc/session.getMessages               │             │
│  │ POST /api/chat/{orgSlug}/{sessionId}             │             │
│  │ POST /api/trpc/apiKey.verify                     │             │
│  │ GET  /api/trpc/user.organizations                │             │
│  └──────────────────────────────────────────────────┘             │
│                                                                     │
│  Services:                                                          │
│  ┌──────────────────┐                                              │
│  │ AI Routing       │ (Claude 4 Sonnet)                           │
│  │ Engine           │                                              │
│  └──────────────────┘                                              │
│                                                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ SQL
                             v
┌─────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tables:                                                            │
│  ┌─────────────────────────────────────────────┐                  │
│  │ deus_sessions                                │                  │
│  │ - id (UUID, PK)                              │                  │
│  │ - organization_id                            │                  │
│  │ - user_id                                    │                  │
│  │ - status (active/paused/completed)           │                  │
│  │ - current_agent (claude-code/codex)          │                  │
│  │ - cwd, metadata                              │                  │
│  └─────────────────────────────────────────────┘                  │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                  │
│  │ deus_messages                                │                  │
│  │ - id (UUID, PK)                              │                  │
│  │ - session_id (FK)                            │                  │
│  │ - role (user/assistant/system)               │                  │
│  │ - parts (JSON array)                         │                  │
│  │ - char_count, model_id                       │                  │
│  └─────────────────────────────────────────────┘                  │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                  │
│  │ deus_api_keys                                │                  │
│  │ - id (UUID, PK)                              │                  │
│  │ - key_hash (SHA-256)                         │                  │
│  │ - user_id, organization_id                   │                  │
│  │ - scopes, expires_at, revoked_at             │                  │
│  └─────────────────────────────────────────────┘                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow: Session Creation

```
┌──────────────┐
│  User (CLI)  │
└──────┬───────┘
       │
       │ 1. deus start
       v
┌──────────────────────────────────────┐
│          core/deus CLI               │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ SessionManager.initialize()    │ │
│  │ - Generate UUID                │ │
│  │ - Get current directory        │ │
│  │ - Get git branch (if repo)     │ │
│  └────────────┬───────────────────┘ │
│               │                      │
│               │ 2. Create session    │
│               v                      │
│  ┌────────────────────────────────┐ │
│  │ SessionSyncService             │ │
│  │ .createSession()               │ │
│  └────────────┬───────────────────┘ │
│               │                      │
└───────────────┼──────────────────────┘
                │
                │ 3. POST /api/trpc/session.create
                │    {
                │      id: "uuid",
                │      organizationId: "org_123",
                │      userId: "user_456",
                │      cwd: "/path/to/project",
                │      metadata: { branch: "main" }
                │    }
                │    Authorization: Bearer deus_sk_...
                v
┌───────────────────────────────────────┐
│         apps/deus Web UI              │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ 1. Verify API key (SHA-256)     │ │
│  │    - Check not expired          │ │
│  │    - Check not revoked          │ │
│  │    - Update last_used_at        │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 4. Validated          │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ 2. Insert into deus_sessions    │ │
│  │    - id: uuid                   │ │
│  │    - status: "active"           │ │
│  │    - current_agent: null        │ │
│  └────────────┬────────────────────┘ │
│               │                       │
└───────────────┼───────────────────────┘
                │
                │ 5. Response: 200 OK
                │    { id, status, createdAt }
                v
┌───────────────────────────────────────┐
│          core/deus CLI                │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Session created successfully    │ │
│  │ Session ID: uuid                │ │
│  │ Status: Active                  │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Ready for input:                    │
│  >                                    │
└───────────────────────────────────────┘
```

---

## Detailed Flow: Message & Routing

```
┌──────────────┐
│  User (CLI)  │
└──────┬───────┘
       │
       │ 1. User types: "Review auth.ts"
       v
┌──────────────────────────────────────┐
│          core/deus CLI               │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Router.route(message)          │ │
│  │ - Parse user input             │ │
│  │ - Extract context              │ │
│  └────────────┬───────────────────┘ │
│               │                      │
│               │ 2. Request routing   │
│               │    decision          │
│               v                      │
│  ┌────────────────────────────────┐ │
│  │ POST /api/chat/org/session-id  │ │
│  │ {                              │ │
│  │   message: "Review auth.ts"    │ │
│  │ }                              │ │
│  └────────────┬───────────────────┘ │
└───────────────┼──────────────────────┘
                │
                │ 3. Request routing decision
                │    Authorization: Bearer deus_sk_...
                v
┌───────────────────────────────────────┐
│         apps/deus Web UI              │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ 1. Verify API key               │ │
│  │ 2. Verify organization access   │ │
│  │ 3. Fetch session metadata       │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 4. Context gathered   │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ AI Routing Engine               │ │
│  │ (Claude 4 Sonnet)               │ │
│  │                                 │ │
│  │ System Prompt:                  │ │
│  │ "You are Deus, an orchestrator  │ │
│  │  - claude-code: code review     │ │
│  │  - codex: testing, browser      │ │
│  │                                 │ │
│  │ Context:                        │ │
│  │ - cwd: /path/to/project         │ │
│  │ - branch: main                  │ │
│  │ - previous agent: null          │ │
│  │                                 │ │
│  │ User request:                   │ │
│  │ "Review auth.ts"                │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 5. AI decision        │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ Response:                       │ │
│  │ {                               │ │
│  │   agent: "claude-code",         │ │
│  │   mcpServers: [],               │ │
│  │   reasoning: "Code review task" │ │
│  │ }                               │ │
│  └────────────┬────────────────────┘ │
└───────────────┼───────────────────────┘
                │
                │ 6. Response: 200 OK
                v
┌───────────────────────────────────────┐
│          core/deus CLI                │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Router received decision        │ │
│  │ - Agent: claude-code            │ │
│  │ - MCP servers: none             │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 7. Start agent        │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ Spawner.start("claude-code")    │ │
│  │ - spawn child process           │ │
│  │ - attach I/O                    │ │
│  │ - send user message             │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 8. Sync message       │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ SessionSyncService              │ │
│  │ .syncMessage()                  │ │
│  │ POST /api/trpc/session.addMsg   │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 9. Update status      │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ SessionSyncService              │ │
│  │ .updateStatus()                 │ │
│  │ POST /api/trpc/session.update   │ │
│  │ { currentAgent: "claude-code" } │ │
│  └─────────────────────────────────┘ │
│                                       │
└───────────────────────────────────────┘
                │
                │ 10. All synced
                v
          Web UI displays
          session with agent
          badge "Claude Code"
```

---

## Detailed Flow: Offline Queue

```
┌──────────────┐
│  User (CLI)  │
└──────┬───────┘
       │
       │ 1. User sends message
       v
┌──────────────────────────────────────┐
│          core/deus CLI               │
│          (Web UI is down)            │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ SessionSyncService             │ │
│  │ .syncMessage()                 │ │
│  └────────────┬───────────────────┘ │
│               │                      │
│               │ 2. Attempt sync      │
│               v                      │
│  ┌────────────────────────────────┐ │
│  │ fetch() → ECONNREFUSED         │ │
│  │ Network error detected         │ │
│  └────────────┬───────────────────┘ │
│               │                      │
│               │ 3. Queue event       │
│               v                      │
│  ┌────────────────────────────────┐ │
│  │ syncQueue.push({               │ │
│  │   type: "message",             │ │
│  │   timestamp: "2025-10-10...",  │ │
│  │   payload: { ... }             │ │
│  │ })                             │ │
│  │                                │ │
│  │ isOnline = false               │ │
│  └────────────┬───────────────────┘ │
│               │                      │
│               │ 4. Display warning   │
│               v                      │
│  ┌────────────────────────────────┐ │
│  │ ⚠ Offline: Changes will sync   │ │
│  │            when online          │ │
│  │ 📤 1 event pending              │ │
│  └─────────────────────────────────┘ │
│                                       │
└───────────────────────────────────────┘

        ... User continues working ...

        Every 5 seconds:
        Auto-sync interval checks queue

┌───────────────────────────────────────┐
│          core/deus CLI                │
│          (Web UI back online)         │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Auto-sync interval triggered    │ │
│  │ Queue size: 3 events            │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 5. Process queue      │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ for event in queue:             │ │
│  │   if event.type == "message":   │ │
│  │     syncMessage(event.payload)  │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 6. Sync successful    │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ isOnline = true                 │ │
│  │ queue = []                      │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 7. Notify user        │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ ✅ Synced 3 events               │ │
│  └─────────────────────────────────┘ │
│                                       │
└───────────────────────────────────────┘
                │
                │ 8. All events in DB
                v
          Web UI shows all
          messages in order
```

---

## Component Responsibilities

### core/deus (CLI)

**Responsibilities**:
1. User interaction (terminal UI)
2. Session lifecycle management
3. Agent orchestration (spawn/manage)
4. Offline queue management
5. API communication (sync)

**Key Files**:
- `/src/lib/orchestrator.ts` - Main orchestration logic
- `/src/lib/router.ts` - Routing decisions
- `/src/lib/sync/session-sync.ts` - Sync service
- `/src/lib/api/client.ts` - API client
- `/src/lib/spawners/` - Agent spawners

**Does NOT**:
- Store sessions long-term (syncs to web UI)
- Make AI routing decisions (delegates to web UI)
- Manage users/organizations (delegates to web UI)

---

### apps/deus (Web UI)

**Responsibilities**:
1. User authentication (Clerk)
2. API key management
3. Session storage (PostgreSQL)
4. AI routing decisions
5. Real-time UI updates
6. Organization management

**Key Files**:
- `/src/app/api/chat/[orgSlug]/[sessionId]/route.ts` - AI routing
- `/api/deus/src/router/session.ts` - Session API
- `/api/deus/src/router/api-key.ts` - API key management
- `/db/deus/src/schema/` - Database schema

**Does NOT**:
- Spawn agents (CLI does this)
- Manage agent I/O (CLI does this)
- Store local session files (CLI does this)

---

## Authentication Flow

```
┌──────────────┐
│  User (CLI)  │
└──────┬───────┘
       │
       │ 1. deus login
       v
┌──────────────────────────────────────┐
│          core/deus CLI               │
│                                      │
│  Prompt: Enter API key               │
│  Input: deus_sk_abc123...            │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ verifyApiKey()                 │ │
│  │ POST /api/trpc/apiKey.verify   │ │
│  └────────────┬───────────────────┘ │
└───────────────┼──────────────────────┘
                │
                │ 2. Verify API key
                │    { key: "deus_sk_abc123..." }
                v
┌───────────────────────────────────────┐
│         apps/deus Web UI              │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ 1. Hash key with SHA-256        │ │
│  │    key_hash = sha256(key)       │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 2. Query database     │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ SELECT * FROM deus_api_keys     │ │
│  │ WHERE key_hash = ?              │ │
│  │ AND revoked_at IS NULL          │ │
│  │ AND (expires_at IS NULL OR      │ │
│  │      expires_at > NOW())        │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 3. Key found          │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ Response:                       │ │
│  │ {                               │ │
│  │   userId: "user_123",           │ │
│  │   organizationId: "org_456",    │ │
│  │   scopes: [...]                 │ │
│  │ }                               │ │
│  └────────────┬────────────────────┘ │
└───────────────┼───────────────────────┘
                │
                │ 4. Response: 200 OK
                v
┌───────────────────────────────────────┐
│          core/deus CLI                │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ getUserOrganizations()          │ │
│  │ GET /api/trpc/user.organizations│ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 5. List orgs          │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ Select organization:            │ │
│  │ 1. Acme Corp                    │ │
│  │ 2. Test Org                     │ │
│  │ > 1                             │ │
│  └────────────┬────────────────────┘ │
│               │                       │
│               │ 6. Save auth config   │
│               v                       │
│  ┌─────────────────────────────────┐ │
│  │ ~/.deus/auth.json               │ │
│  │ {                               │ │
│  │   apiKey: "deus_sk_abc123...",  │ │
│  │   apiUrl: "http://...",         │ │
│  │   organizationId: "org_456",    │ │
│  │   userId: "user_123"            │ │
│  │ }                               │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ✅ Login successful                  │
│  Organization: Acme Corp              │
└───────────────────────────────────────┘
```

---

## Technology Stack

### core/deus (CLI)
- **Language**: TypeScript
- **Runtime**: Node.js
- **UI**: Ink (React for CLIs)
- **Process Management**: node-pty, execa
- **Config**: JSON files in `~/.deus/`
- **MCP**: @modelcontextprotocol/sdk

### apps/deus (Web UI)
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Auth**: Clerk
- **API**: tRPC + REST
- **AI**: Anthropic Claude via AI SDK
- **Database**: PostgreSQL (Drizzle ORM)
- **Styling**: Tailwind CSS v4

### Shared Packages
- **@db/deus**: Database schema and client
- **@api/deus**: tRPC router definitions
- **@repo/deus-types**: Shared TypeScript types
- **@repo/deus-api-services**: Service layer for API calls
- **@repo/deus-trpc**: tRPC client utilities

---

## Security Model

### API Key Storage

**CLI**: Plain text in `~/.deus/auth.json` (file permissions: 0600)
**Web UI**: SHA-256 hash in database

### API Key Validation

```
1. Client sends: Authorization: Bearer deus_sk_abc123...
2. Server hashes: sha256(deus_sk_abc123...)
3. Server queries: SELECT ... WHERE key_hash = <hash>
4. Server checks: NOT revoked AND NOT expired
5. Server validates: Organization access
6. Server updates: last_used_at = NOW()
```

### Scopes

- `sessions:read` - List/get sessions
- `sessions:write` - Create/update sessions
- `messages:read` - Read messages
- `messages:write` - Add messages
- `routing:read` - Get routing decisions

**Default**: All scopes for CLI-generated keys

---

## File System Structure

### CLI
```
~/.deus/
├── auth.json              # Auth config
├── sessions/
│   └── <session-id>.jsonl # Session events (event sourcing)
└── logs/
    └── deus.log           # Debug logs
```

### Web UI
```
apps/deus/
├── src/
│   ├── app/
│   │   ├── (app)/         # Public pages
│   │   ├── (trpc)/        # tRPC routes
│   │   └── api/
│   │       └── chat/      # AI routing endpoint
│   └── components/        # React components
└── .vercel/
    └── .env.development.local # Environment variables
```

---

## Monitoring & Observability

### CLI Logs
```bash
# Enable debug mode
DEBUG=1 deus start

# Logs show:
[SessionSync] Creating session: uuid
[Router] Requesting routing decision...
[Router] Decision: claude-code
[Spawner] Starting claude-code...
[SessionSync] Syncing message...
[SessionSync] Auto-sync: 0 queued events
```

### Web UI Logs
```bash
# Server logs (console)
[Deus Router] req_123 - "Review code" → claude-code (Code review task)
[tRPC] session.create - 200 OK (127ms)
[tRPC] session.addMessage - 200 OK (43ms)
```

### Database Queries
```sql
-- Active sessions
SELECT id, status, current_agent, created_at
FROM deus_sessions
WHERE status = 'active'
ORDER BY created_at DESC;

-- Messages per session
SELECT COUNT(*) as msg_count, session_id
FROM deus_messages
GROUP BY session_id;

-- API key usage
SELECT name, last_used_at, COUNT(*) as usage
FROM deus_api_keys
WHERE revoked_at IS NULL
GROUP BY name, last_used_at;
```

---

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| API key verification | < 50ms | Indexed by key_hash |
| Session creation | < 500ms | Includes DB write |
| Message sync | < 200ms | Includes DB write |
| AI routing decision | < 2s | Depends on AI latency |
| Queue processing | < 1s per event | Sequential processing |
| Session list query | < 100ms | Paginated, indexed |

---

## Error Handling Strategy

### CLI Error Handling

1. **Network Errors** → Queue for retry
2. **Auth Errors** → Prompt re-login
3. **Validation Errors** → Show user-friendly message
4. **Agent Errors** → Show error + recovery suggestions

### Web UI Error Handling

1. **Invalid API Key** → 401 Unauthorized
2. **Expired API Key** → 401 Unauthorized
3. **Revoked API Key** → 401 Unauthorized
4. **Organization Mismatch** → 403 Forbidden
5. **Session Not Found** → 404 Not Found
6. **Server Errors** → 500 Internal Server Error (with request ID)

---

## Future Enhancements

### Short-term (1-2 months)
- [ ] WebSocket support for real-time updates
- [ ] Session resume capability
- [ ] Multi-user collaboration on sessions
- [ ] Advanced routing with context learning

### Medium-term (3-6 months)
- [ ] Browser-based CLI (web terminal)
- [ ] Session replay functionality
- [ ] Agent performance analytics
- [ ] Custom routing rules per organization

### Long-term (6+ months)
- [ ] Agent marketplace
- [ ] Custom agent definitions
- [ ] Advanced workflow automation
- [ ] Enterprise SSO support

---

## Related Documentation

- **Full Testing Guide**: `/TESTING.md`
- **Testing Summary**: `/TESTING-SUMMARY.md`
- **Deus App Docs**: `/apps/deus/CLAUDE.md`
- **Core Deus Docs**: `/core/deus/README.md`
- **Database Schema**: `/db/deus/src/schema/`
