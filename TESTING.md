# Deus Testing Guide

## Architecture Overview

### Component Relationship Clarification

**apps/chat** and **apps/deus** are **separate applications** with no integration:

- **apps/chat**: AI chat interface for general-purpose Claude conversation (port 4106)
- **apps/deus**: Web UI for Deus CLI orchestration platform (port 4107)
- **core/deus**: CLI tool that orchestrates Claude Code and Codex agents via terminal

**Integration Path**: `core/deus` (CLI) ↔ `apps/deus` (Web UI)

```
┌──────────────┐
│  apps/chat   │  (Standalone - No integration)
│  Port 4106   │
└──────────────┘

┌──────────────┐         API (tRPC + REST)        ┌──────────────┐
│  core/deus   │  ←─────────────────────────────→ │  apps/deus   │
│  CLI Tool    │                                   │  Web UI      │
│              │  - API key authentication         │  Port 4107   │
│              │  - Session sync                   │              │
│              │  - Message sync                   │              │
│              │  - AI routing decisions           │              │
└──────────────┘                                   └──────────────┘
       │                                                   │
       │                                                   │
       v                                                   v
┌──────────────┐                                   ┌──────────────┐
│   @db/deus   │  (Shared database schema)        │   @db/deus   │
└──────────────┘                                   └──────────────┘
```

### Key Integration Points

1. **Authentication**: API key-based (generated in apps/deus, used by core/deus)
2. **Session Management**: CLI creates sessions, syncs to web UI
3. **Message Streaming**: CLI sends messages to web UI for display
4. **AI Routing**: CLI asks web UI which agent to use (Claude Code vs Codex)
5. **Status Updates**: Real-time session status (active, paused, completed)

---

## Part 1: Manual Testing Workflows

### Prerequisites

```bash
# 1. Build the core/deus CLI
cd /Users/jeevanpillay/Code/@lightfastai/lightfast/core/deus
pnpm install
pnpm build

# 2. Start the web UI
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
pnpm dev:deus  # Starts on port 4107

# 3. Run database migrations (if needed)
pnpm db:migrate

# 4. (Optional) Open database studio to inspect data
pnpm db:studio
```

---

### Workflow 1: Authentication & API Key Management

**Objective**: Generate API key in web UI and authenticate CLI

#### Test Steps

1. **Generate API Key in Web UI**
   ```bash
   # Open browser
   open http://localhost:4107

   # Login with Clerk (use test credentials from apps/deus/CLAUDE.md)
   # Navigate to: Settings → API Keys → Generate New Key
   ```

   **Expected Result**:
   - API key displayed in format: `deus_sk_...`
   - Key saved to database (hashed with SHA-256)
   - Scopes assigned (default: all)
   - Expiry date set (or null for no expiry)

2. **Authenticate CLI with API Key**
   ```bash
   cd /Users/jeevanpillay/Code/@lightfastai/lightfast/core/deus

   # Run CLI with authentication
   ./dist/cli.js login

   # Enter API key when prompted: deus_sk_...
   # Select organization
   ```

   **Expected Result**:
   - API key verified via `POST /api/trpc/apiKey.verify`
   - Organization list fetched via `GET /api/trpc/user.organizations`
   - Auth config saved to `~/.deus/auth.json`
   - Success message displayed

3. **Verify Authentication Status**
   ```bash
   ./dist/cli.js status
   ```

   **Expected Result**:
   - Shows logged-in user
   - Shows selected organization
   - Shows API key validity (last 4 chars)

4. **Test Invalid API Key**
   ```bash
   # Manually edit ~/.deus/auth.json with invalid key
   ./dist/cli.js status
   ```

   **Expected Result**:
   - Error: "Invalid API key"
   - Prompt to login again

5. **Test Expired API Key**
   ```sql
   -- In database studio, expire the API key
   UPDATE deus_api_keys
   SET expires_at = '2020-01-01T00:00:00Z'
   WHERE key_hash = '<hash>';
   ```

   **Expected Result**:
   - CLI shows "API key expired"
   - Web UI shows key as expired in UI

6. **Test Revoked API Key**
   ```bash
   # In web UI, revoke the API key
   # Settings → API Keys → Revoke

   # Then try to use CLI
   ./dist/cli.js status
   ```

   **Expected Result**:
   - CLI shows "API key revoked"
   - Cannot perform any operations

7. **Logout from CLI**
   ```bash
   ./dist/cli.js logout
   ```

   **Expected Result**:
   - Auth config removed from `~/.deus/auth.json`
   - Status shows "Not logged in"

---

### Workflow 2: Session Lifecycle

**Objective**: Create session in CLI and verify it appears in web UI

#### Test Steps

1. **Start New Session**
   ```bash
   cd /path/to/test-project

   # Start Deus session
   deus start
   ```

   **Expected Result**:
   - Session created in CLI with UUID
   - Session synced to web UI via `POST /api/trpc/session.create`
   - Session appears in web UI: Sessions → Active
   - Initial metadata stored: cwd, git branch (if git repo)

2. **Verify Session in Web UI**
   ```bash
   open http://localhost:4107/org/<org-slug>/sessions
   ```

   **Expected Result**:
   - Session listed with:
     - Session ID
     - Status: "active"
     - Created timestamp
     - Current working directory
     - Current agent: null (not started yet)

3. **Send Message to Session**
   ```bash
   # In CLI, type a message
   > Hello, review the auth.ts file
   ```

   **Expected Result**:
   - Message sent to CLI orchestrator
   - CLI asks web UI for routing decision via `POST /api/chat/<orgSlug>/<sessionId>`
   - Web UI returns routing decision:
     ```json
     {
       "agent": "claude-code",
       "mcpServers": [],
       "reasoning": "Code review task requires Claude Code"
     }
     ```
   - Message synced to web UI via `POST /api/trpc/session.addMessage`
   - Message appears in web UI: Sessions → <session-id> → Messages

4. **Start Agent**
   ```bash
   # CLI automatically starts the routed agent (Claude Code)
   # Claude Code spawns as subprocess
   ```

   **Expected Result**:
   - CLI shows "Starting claude-code..."
   - Session status updated to "active" (already active)
   - Current agent updated via `POST /api/trpc/session.update`:
     ```json
     {
       "id": "<session-id>",
       "currentAgent": "claude-code"
     }
     ```
   - Web UI shows current agent badge: "Claude Code"

5. **Verify Real-Time Status Updates**
   ```bash
   # While Claude Code is running, check web UI
   open http://localhost:4107/org/<org-slug>/sessions/<session-id>
   ```

   **Expected Result**:
   - Session status shows "active"
   - Current agent shows "claude-code"
   - Message history updates in real-time (via polling or WebSocket)
   - Assistant responses appear as they stream

6. **Switch Agent**
   ```bash
   # In CLI, send a message that requires Codex
   > Write Playwright tests for the login flow
   ```

   **Expected Result**:
   - CLI asks web UI for routing decision
   - Web UI returns:
     ```json
     {
       "agent": "codex",
       "mcpServers": ["playwright"],
       "reasoning": "Browser testing requires Codex with Playwright"
     }
     ```
   - CLI switches agent: stops Claude Code, starts Codex
   - Session updated via `POST /api/trpc/session.update`:
     ```json
     {
       "id": "<session-id>",
       "currentAgent": "codex"
     }
     ```
   - Web UI shows current agent badge: "Codex"

7. **Complete Session**
   ```bash
   # Exit CLI
   Ctrl+C
   ```

   **Expected Result**:
   - CLI updates session status via `POST /api/trpc/session.update`:
     ```json
     {
       "id": "<session-id>",
       "status": "completed"
     }
     ```
   - Web UI shows session status: "Completed"
   - Session moves to "Completed" tab

---

### Workflow 3: Routing Integration (CLI ↔ Web UI)

**Objective**: Test AI-based routing decisions from web UI

#### Test Steps

1. **Code Review Request**
   ```bash
   # In CLI
   > Review the authentication code in src/auth.ts
   ```

   **Expected Result**:
   - CLI sends request to `POST /api/chat/<orgSlug>/<sessionId>`
   - Web UI uses AI to determine routing:
     ```json
     {
       "agent": "claude-code",
       "mcpServers": [],
       "reasoning": "Code review task best handled by Claude Code"
     }
     ```
   - CLI routes to Claude Code

2. **Testing Request**
   ```bash
   > Write E2E tests with Playwright for the checkout flow
   ```

   **Expected Result**:
   - Web UI returns:
     ```json
     {
       "agent": "codex",
       "mcpServers": ["playwright"],
       "reasoning": "E2E testing with Playwright requires Codex"
     }
     ```
   - CLI routes to Codex with Playwright MCP server enabled

3. **Debugging Request**
   ```bash
   > Debug why the login button isn't working
   ```

   **Expected Result**:
   - Web UI returns:
     ```json
     {
       "agent": "claude-code",
       "mcpServers": [],
       "reasoning": "Debugging requires code analysis"
     }
     ```
   - CLI routes to Claude Code

4. **Web Scraping Request**
   ```bash
   > Scrape product prices from https://example.com
   ```

   **Expected Result**:
   - Web UI returns:
     ```json
     {
       "agent": "codex",
       "mcpServers": ["playwright", "browserbase"],
       "reasoning": "Web scraping requires browser automation"
     }
     ```
   - CLI routes to Codex with Playwright + Browserbase

5. **Ambiguous Request**
   ```bash
   > Help me with the project
   ```

   **Expected Result**:
   - Web UI uses previous context (session.currentAgent) to decide
   - If no previous agent, defaults to Claude Code
   - Returns reasoning explaining the choice

6. **Test Fallback (Web UI Down)**
   ```bash
   # Stop web UI
   pkill -f "next dev"

   # Try to send message in CLI
   > Review the code
   ```

   **Expected Result**:
   - CLI detects web UI is down (fetch error)
   - Falls back to local routing logic (if implemented)
   - OR shows warning: "Routing service unavailable, using default agent"
   - Routes to Claude Code (default)

7. **Test Recovery (Web UI Back Up)**
   ```bash
   # Restart web UI
   pnpm dev:deus

   # Send another message
   > Write tests
   ```

   **Expected Result**:
   - CLI detects web UI is back online
   - Resumes AI-based routing
   - Queued events (if any) are synced

---

### Workflow 4: Offline/Online Behavior

**Objective**: Test CLI behavior when web UI is unavailable

#### Test Steps

1. **Start Session While Online**
   ```bash
   # With web UI running
   deus start
   > Hello
   ```

   **Expected Result**:
   - Session created online
   - Messages synced immediately

2. **Disconnect Network/Stop Web UI**
   ```bash
   # Stop web UI
   pkill -f "next dev"

   # Continue using CLI
   > Write a function to calculate fibonacci
   ```

   **Expected Result**:
   - CLI detects web UI is down
   - Queues events for later sync (SessionSyncService)
   - Shows warning: "⚠ Offline: Changes will sync when online"
   - Agent continues to work locally

3. **Queue Multiple Events Offline**
   ```bash
   # Send multiple messages while offline
   > Create a new file utils.ts
   > Add tests for utils.ts
   > Run the tests
   ```

   **Expected Result**:
   - All events queued locally
   - CLI continues to function
   - Queue size displayed: "📤 3 events pending sync"

4. **Reconnect Network/Restart Web UI**
   ```bash
   # Restart web UI
   pnpm dev:deus

   # CLI auto-detects reconnection
   ```

   **Expected Result**:
   - CLI detects web UI is online
   - Processes sync queue automatically
   - Shows: "✅ Synced 3 events"
   - All queued events appear in web UI

5. **Verify Sync Order**
   ```bash
   # Check web UI
   open http://localhost:4107/org/<org-slug>/sessions/<session-id>
   ```

   **Expected Result**:
   - Events appear in correct chronological order
   - No duplicates
   - All timestamps preserved

6. **Test Auto-Sync Interval**
   ```bash
   # Check auto-sync in CLI logs (DEBUG=1)
   DEBUG=1 deus start
   ```

   **Expected Result**:
   - Every 5 seconds, auto-sync attempts to process queue
   - Logs: `[SessionSync] Auto-sync: X queued events`
   - Continues until queue is empty

---

### Workflow 5: Multi-Session Testing

**Objective**: Test multiple concurrent sessions

#### Test Steps

1. **Start First Session**
   ```bash
   cd /path/to/project-a
   deus start
   ```

   **Expected Result**:
   - Session A created
   - Session ID: `<session-a-id>`

2. **Start Second Session (Different Terminal)**
   ```bash
   cd /path/to/project-b
   deus start
   ```

   **Expected Result**:
   - Session B created
   - Session ID: `<session-b-id>`
   - Both sessions independent

3. **Verify Both Sessions in Web UI**
   ```bash
   open http://localhost:4107/org/<org-slug>/sessions
   ```

   **Expected Result**:
   - Both sessions listed
   - Session A: project-a cwd
   - Session B: project-b cwd
   - Both show "active" status

4. **Send Messages to Both Sessions**
   ```bash
   # Terminal 1 (Session A)
   > Review auth.ts

   # Terminal 2 (Session B)
   > Write tests for api.ts
   ```

   **Expected Result**:
   - Session A routes to Claude Code
   - Session B routes to Codex
   - Messages don't cross-contaminate
   - Web UI shows correct messages per session

5. **Complete One Session**
   ```bash
   # Terminal 1 (Session A)
   Ctrl+C
   ```

   **Expected Result**:
   - Session A status: "completed"
   - Session B still "active"
   - Web UI updates Session A only

6. **Resume Session A (If Supported)**
   ```bash
   cd /path/to/project-a
   deus resume <session-a-id>
   ```

   **Expected Result**:
   - Session A reactivated
   - Previous messages loaded from web UI
   - Status updated to "active"

---

### Workflow 6: Error Handling

**Objective**: Test error scenarios and recovery

#### Test Steps

1. **Invalid API Key**
   ```bash
   # Manually edit ~/.deus/auth.json
   {
     "apiKey": "deus_sk_invalid",
     ...
   }

   deus start
   ```

   **Expected Result**:
   - Error: "Invalid API key. Please login again."
   - Prompts: `deus login`

2. **Expired API Key**
   ```bash
   # Expire key in database
   deus start
   ```

   **Expected Result**:
   - Error: "API key expired. Please generate a new key."
   - Link to settings page

3. **Revoked API Key**
   ```bash
   # Revoke key in web UI
   deus start
   ```

   **Expected Result**:
   - Error: "API key revoked. Please generate a new key."

4. **Network Failure During Session Create**
   ```bash
   # Disconnect network
   deus start
   ```

   **Expected Result**:
   - Error: "Unable to connect to Deus API. Check your network."
   - Option to retry or work offline

5. **Web App Error (500)**
   ```bash
   # Simulate 500 error in web UI (modify route to throw error)
   deus start
   ```

   **Expected Result**:
   - Error: "Server error. Please try again later."
   - Request ID displayed for debugging: `req_1234567890_abc123`

6. **Session Not Found**
   ```bash
   deus resume <non-existent-session-id>
   ```

   **Expected Result**:
   - Error: "Session not found. It may have been deleted."

7. **Organization Mismatch**
   ```bash
   # Create session with Org A's API key
   # Manually change session.organizationId to Org B
   # Try to access session
   ```

   **Expected Result**:
   - Error: "You don't have access to this session."

8. **Agent Spawn Failure**
   ```bash
   # Make claude or codex command unavailable
   deus start
   > Write tests
   ```

   **Expected Result**:
   - Error: "Failed to start agent: codex not found"
   - Suggestion: "Install codex: npm install -g @codex/cli"

---

## Part 2: Automated Testing Strategy

### Unit Tests

#### 1. SessionSyncService Tests

**File**: `core/deus/src/lib/sync/__tests__/session-sync.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionSyncService } from '../session-sync';

describe('SessionSyncService', () => {
  let mockAuthConfig: AuthConfig;
  let syncService: SessionSyncService;

  beforeEach(() => {
    mockAuthConfig = {
      apiKey: 'deus_sk_test123',
      apiUrl: 'http://localhost:4107',
      organizationId: 'org_123',
      userId: 'user_123',
    };
    syncService = new SessionSyncService(mockAuthConfig);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('createSession', () => {
    it('should create session and sync to API', async () => {
      const mockSession: DeusSessionState = {
        sessionId: 'session_123',
        status: 'active',
        metadata: { cwd: '/test' },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await syncService.createSession(mockSession);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4107/api/trpc/session.create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer deus_sk_test123',
          }),
        })
      );
    });

    it('should queue event when API is down', async () => {
      const mockSession: DeusSessionState = {
        sessionId: 'session_123',
        status: 'active',
        metadata: { cwd: '/test' },
      };

      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await syncService.createSession(mockSession);

      expect(syncService.getQueueSize()).toBe(1);
      expect(syncService.isServiceOnline()).toBe(false);
    });
  });

  describe('syncMessage', () => {
    it('should sync message to API', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await syncService.syncMessage(
        'session_123',
        'user',
        'Hello world',
        'claude-3-5-sonnet',
        'claude-code'
      );

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4107/api/trpc/session.addMessage',
        expect.objectContaining({
          body: expect.stringContaining('Hello world'),
        })
      );
    });
  });

  describe('offline queue', () => {
    it('should process queue when back online', async () => {
      // Queue 3 events while offline
      vi.mocked(fetch).mockRejectedValue(new Error('Offline'));

      await syncService.createSession({ sessionId: '1', status: 'active', metadata: { cwd: '/' } });
      await syncService.syncMessage('1', 'user', 'msg1');
      await syncService.syncMessage('1', 'user', 'msg2');

      expect(syncService.getQueueSize()).toBe(3);

      // Go back online
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await syncService.processQueue();

      expect(syncService.getQueueSize()).toBe(0);
      expect(syncService.isServiceOnline()).toBe(true);
    });

    it('should retry failed events in order', async () => {
      // ...test implementation
    });
  });

  describe('auto-sync', () => {
    it('should start auto-sync interval', () => {
      vi.useFakeTimers();

      syncService.startAutoSync('session_123');

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      // Should have attempted sync
      expect(syncService.getQueueSize()).toBe(0);

      vi.useRealTimers();
    });
  });
});
```

#### 2. API Client Tests

**File**: `core/deus/src/lib/api/__tests__/client.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { verifyApiKey, getUserOrganizations } from '../client';

describe('API Client', () => {
  describe('verifyApiKey', () => {
    it('should verify valid API key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: 'user_123',
          organizationId: 'org_123',
          scopes: ['sessions:read', 'sessions:write'],
        }),
      } as Response);

      const result = await verifyApiKey('deus_sk_test123');

      expect(result.userId).toBe('user_123');
      expect(result.organizationId).toBe('org_123');
    });

    it('should throw on invalid API key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
        }),
      } as Response);

      await expect(verifyApiKey('invalid_key')).rejects.toThrow('Invalid API key');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(verifyApiKey('deus_sk_test123')).rejects.toThrow('Network error');
    });
  });

  describe('getUserOrganizations', () => {
    it('should fetch user organizations', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          organizations: [
            { id: 'org_1', slug: 'acme', name: 'Acme Corp', role: 'admin' },
            { id: 'org_2', slug: 'test', name: 'Test Org', role: 'member' },
          ],
        }),
      } as Response);

      const orgs = await getUserOrganizations('deus_sk_test123');

      expect(orgs).toHaveLength(2);
      expect(orgs[0].slug).toBe('acme');
    });
  });
});
```

### Integration Tests

#### 1. Session API Routes Tests

**File**: `apps/deus/src/app/__tests__/session-routes.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { POST as createSession } from '../(trpc)/api/trpc/[trpc]/route';
import { db } from '@db/deus/client';
import { DeusApiKey, DeusSession } from '@db/deus/schema';

describe('Session API Routes (Integration)', () => {
  let testApiKey: string;
  let testUserId: string;
  let testOrgId: string;

  beforeEach(async () => {
    // Setup test data
    testUserId = 'test_user_' + Date.now();
    testOrgId = 'test_org_' + Date.now();

    // Generate test API key
    const keyHash = await hashApiKey('deus_sk_test123');
    await db.insert(DeusApiKey).values({
      id: 'key_test_' + Date.now(),
      organizationId: testOrgId,
      userId: testUserId,
      keyHash,
      name: 'Test Key',
      scopes: ['sessions:read', 'sessions:write'],
      expiresAt: null,
      revokedAt: null,
    });

    testApiKey = 'deus_sk_test123';
  });

  describe('POST /api/trpc/session.create', () => {
    it('should create session with valid API key', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testApiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          id: 'session_test_123',
          organizationId: testOrgId,
          userId: testUserId,
          cwd: '/test/project',
          metadata: { branch: 'main' },
        },
      });

      await createSession(req, res);

      expect(res._getStatusCode()).toBe(200);

      const session = await db
        .select()
        .from(DeusSession)
        .where(eq(DeusSession.id, 'session_test_123'))
        .limit(1);

      expect(session[0]).toBeDefined();
      expect(session[0].cwd).toBe('/test/project');
    });

    it('should reject invalid API key', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid_key',
        },
      });

      await createSession(req, res);

      expect(res._getStatusCode()).toBe(401);
    });
  });

  describe('POST /api/trpc/session.addMessage', () => {
    it('should add message to session', async () => {
      // Create session first
      await db.insert(DeusSession).values({
        id: 'session_123',
        organizationId: testOrgId,
        userId: testUserId,
        cwd: '/test',
        status: 'active',
      });

      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${testApiKey}`,
        },
        body: {
          sessionId: 'session_123',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      });

      await addMessage(req, res);

      expect(res._getStatusCode()).toBe(200);

      const messages = await db
        .select()
        .from(DeusMessage)
        .where(eq(DeusMessage.sessionId, 'session_123'));

      expect(messages).toHaveLength(1);
      expect(messages[0].parts[0].text).toBe('Hello');
    });
  });
});
```

#### 2. AI Routing Integration Tests

**File**: `apps/deus/src/app/api/chat/__tests__/routing.integration.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { POST } from '../[orgSlug]/[sessionId]/route';
import { generateObject } from 'ai';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

describe('AI Routing Integration', () => {
  it('should route code review to claude-code', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        agent: 'claude-code',
        mcpServers: [],
        reasoning: 'Code review task',
      },
    });

    const req = new Request('http://localhost/api/chat/acme/session_123', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer deus_sk_test123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Review the auth.ts file',
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ orgSlug: 'acme', sessionId: 'session_123' }),
    });

    const data = await res.json();

    expect(data.agent).toBe('claude-code');
    expect(data.mcpServers).toEqual([]);
  });

  it('should route testing to codex with playwright', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        agent: 'codex',
        mcpServers: ['playwright'],
        reasoning: 'E2E testing requires Codex',
      },
    });

    const req = new Request('http://localhost/api/chat/acme/session_123', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Write Playwright tests for login',
      }),
    });

    const res = await POST(req, { params: { orgSlug: 'acme', sessionId: 'session_123' } });
    const data = await res.json();

    expect(data.agent).toBe('codex');
    expect(data.mcpServers).toContain('playwright');
  });

  it('should handle organization mismatch', async () => {
    // API key belongs to org_123, but requesting org_456
    const req = new Request('http://localhost/api/chat/different-org/session_123', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer deus_sk_test123' },
    });

    const res = await POST(req, { params: { orgSlug: 'different-org', sessionId: 'session_123' } });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.type).toBe('FORBIDDEN');
  });
});
```

### End-to-End Tests

#### 1. Full Session Workflow

**File**: `core/deus/src/__tests__/e2e/session-workflow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';

describe('E2E: Session Workflow', () => {
  let webServerProcess: ChildProcess;
  let cliProcess: ChildProcess;
  let testApiKey: string;

  beforeAll(async () => {
    // Start web server
    webServerProcess = spawn('pnpm', ['dev:deus'], {
      cwd: '/Users/jeevanpillay/Code/@lightfastai/lightfast',
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Generate test API key via API
    const res = await fetch('http://localhost:4107/api/trpc/apiKey.generate', {
      method: 'POST',
      headers: { /* Clerk auth headers */ },
      body: JSON.stringify({ name: 'E2E Test Key' }),
    });
    const data = await res.json();
    testApiKey = data.key;
  });

  afterAll(async () => {
    webServerProcess.kill();
  });

  it('should complete full session workflow', async () => {
    // 1. Login CLI
    cliProcess = spawn('deus', ['login'], {
      env: { ...process.env, DEUS_API_KEY: testApiKey },
    });

    // Wait for login to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. Start session
    const sessionId = crypto.randomUUID();
    cliProcess = spawn('deus', ['start'], {
      cwd: '/tmp/test-project',
    });

    // Wait for session to be created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Verify session exists in web UI
    const sessionRes = await fetch(
      `http://localhost:4107/api/trpc/session.list?organizationId=org_123`
    );
    const sessions = await sessionRes.json();

    expect(sessions.sessions).toHaveLength(1);
    expect(sessions.sessions[0].cwd).toBe('/tmp/test-project');

    // 4. Send message via CLI
    cliProcess.stdin.write('Review the code\n');

    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Verify message appears in web UI
    const messagesRes = await fetch(
      `http://localhost:4107/api/trpc/session.getMessages?sessionId=${sessionId}`
    );
    const messages = await messagesRes.json();

    expect(messages.messages).toContainEqual(
      expect.objectContaining({ role: 'user', parts: [{ type: 'text', text: 'Review the code' }] })
    );

    // 6. Complete session
    cliProcess.kill('SIGINT');

    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 7. Verify session status is completed
    const finalSessionRes = await fetch(
      `http://localhost:4107/api/trpc/session.get?id=${sessionId}`
    );
    const finalSession = await finalSessionRes.json();

    expect(finalSession.status).toBe('completed');
  });
});
```

---

## Part 3: Testing Tools & Setup

### 1. Testing Frameworks

```json
// packages.json additions
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "node-mocks-http": "^1.14.0",
    "ws": "^8.16.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "playwright": "^1.41.0"
  }
}
```

### 2. Vitest Configuration

**File**: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@db/deus': path.resolve(__dirname, '../../db/deus/src'),
      '@repo/deus-types': path.resolve(__dirname, '../../packages/deus-types/src'),
    },
  },
});
```

**File**: `vitest.setup.ts`

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { db } from '@db/deus/client';
import { sql } from 'drizzle-orm';

// Setup test database
beforeAll(async () => {
  // Run migrations
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS test`);

  // Seed test data
  // ...
});

// Cleanup after each test
afterEach(async () => {
  // Truncate all tables
  await db.execute(sql`TRUNCATE TABLE deus_sessions CASCADE`);
  await db.execute(sql`TRUNCATE TABLE deus_messages CASCADE`);
  await db.execute(sql`TRUNCATE TABLE deus_api_keys CASCADE`);
});

// Cleanup after all tests
afterAll(async () => {
  await db.execute(sql`DROP SCHEMA test CASCADE`);
});
```

### 3. Mock Data Utilities

**File**: `core/deus/src/__tests__/mocks/data.ts`

```typescript
import { DeusSessionState } from '../../types';

export function mockSession(overrides?: Partial<DeusSessionState>): DeusSessionState {
  return {
    sessionId: crypto.randomUUID(),
    status: 'active',
    metadata: {
      cwd: '/test/project',
      branch: 'main',
    },
    linkedAgents: [],
    tasks: [],
    sharedContext: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function mockApiKey(overrides?: Partial<any>): any {
  return {
    id: 'key_' + Date.now(),
    userId: 'user_123',
    organizationId: 'org_123',
    keyHash: 'hash_' + Math.random(),
    name: 'Test Key',
    scopes: ['sessions:read', 'sessions:write'],
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function mockAuthConfig() {
  return {
    apiKey: 'deus_sk_test123',
    apiUrl: 'http://localhost:4107',
    organizationId: 'org_123',
    userId: 'user_123',
  };
}
```

### 4. Test Environment Setup Script

**File**: `scripts/setup-test-env.sh`

```bash
#!/bin/bash

# Setup test environment for Deus integration testing

set -e

echo "🚀 Setting up test environment..."

# 1. Start PostgreSQL for testing (if not running)
if ! pg_isready -q; then
  echo "Starting PostgreSQL..."
  pg_ctl start -D /usr/local/var/postgres
fi

# 2. Create test database
echo "Creating test database..."
psql -U postgres -c "DROP DATABASE IF EXISTS deus_test;"
psql -U postgres -c "CREATE DATABASE deus_test;"

# 3. Run migrations
echo "Running migrations..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/deus_test"
pnpm db:migrate

# 4. Seed test data
echo "Seeding test data..."
node scripts/seed-test-data.js

# 5. Build packages
echo "Building packages..."
pnpm --filter @lightfastai/deus build
pnpm --filter @api/deus build

echo "✅ Test environment ready!"
echo ""
echo "Run tests with:"
echo "  pnpm test                  # All tests"
echo "  pnpm test:unit            # Unit tests only"
echo "  pnpm test:integration     # Integration tests only"
echo "  pnpm test:e2e             # E2E tests only"
```

### 5. CI/CD Integration

**File**: `.github/workflows/test-deus-integration.yml`

```yaml
name: Test Deus Integration

on:
  push:
    branches: [main, deus/*]
    paths:
      - 'core/deus/**'
      - 'apps/deus/**'
      - 'api/deus/**'
      - 'packages/deus-*/**'
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/unit/coverage-final.json

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: deus_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Setup test database
        run: |
          export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/deus_test"
          pnpm db:migrate

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/deus_test

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: deus_test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: |
          pnpm --filter @lightfastai/deus build
          pnpm --filter @lightfast/deus build

      - name: Start web app
        run: |
          pnpm dev:deus &
          sleep 10
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/deus_test

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          DEUS_API_URL: http://localhost:4107
```

---

## Part 4: Testing Checklist

### Pre-Release Testing Checklist

#### Authentication
- [ ] Generate API key in web UI
- [ ] Login with CLI using API key
- [ ] Verify API key in database (SHA-256 hash)
- [ ] Test expired API key
- [ ] Test revoked API key
- [ ] Test invalid API key format
- [ ] Logout from CLI

#### Session Management
- [ ] Create session in CLI
- [ ] Verify session in web UI
- [ ] Send messages via CLI
- [ ] Verify messages in web UI
- [ ] Update session status
- [ ] Complete session
- [ ] Resume session (if supported)

#### AI Routing
- [ ] Code review → Claude Code
- [ ] Testing → Codex + Playwright
- [ ] Debugging → Claude Code
- [ ] Web scraping → Codex + Playwright + Browserbase
- [ ] Ambiguous request → Default/context-based routing
- [ ] Fallback when web UI is down

#### Offline/Online
- [ ] Start session online
- [ ] Go offline mid-session
- [ ] Queue events while offline
- [ ] Reconnect and sync queue
- [ ] Verify event order
- [ ] Test auto-sync interval

#### Multi-Session
- [ ] Start multiple concurrent sessions
- [ ] Verify isolation between sessions
- [ ] Complete one session while others active
- [ ] Resume completed session

#### Error Handling
- [ ] Invalid API key
- [ ] Expired API key
- [ ] Revoked API key
- [ ] Network failure
- [ ] Web app 500 error
- [ ] Session not found
- [ ] Organization mismatch
- [ ] Agent spawn failure

#### Performance
- [ ] Session create < 500ms
- [ ] Message sync < 200ms
- [ ] AI routing < 2s
- [ ] Queue processing < 1s per event
- [ ] Web UI load time < 1s

---

## Summary

This comprehensive testing guide covers:

1. **Manual Testing Workflows**: 6 detailed workflows covering all integration points
2. **Automated Testing Strategy**: Unit, integration, and E2E tests
3. **Testing Tools & Setup**: Vitest, mock utilities, CI/CD
4. **Testing Checklist**: Pre-release checklist

**Key Takeaways**:
- `apps/chat` and `apps/deus` are **separate applications** with no integration
- Integration is **core/deus (CLI) ↔ apps/deus (Web UI)**
- Focus testing on: Authentication, Session Sync, AI Routing, Offline/Online behavior
- Use API key authentication (not Clerk) for CLI → Web UI communication
- Implement graceful degradation when web UI is unavailable

**Next Steps**:
1. Implement unit tests for SessionSyncService
2. Add integration tests for session routes
3. Set up E2E testing environment
4. Create CI/CD pipeline
5. Document test results and coverage
