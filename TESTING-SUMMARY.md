# Deus Testing Summary

## Quick Reference Guide

### Architecture Clarification

**Question**: Is there integration between apps/chat and core/deus?

**Answer**: **NO**. These are separate applications:

- **apps/chat** (port 4106): Standalone AI chat interface
- **apps/deus** (port 4107): Web UI for Deus orchestration platform
- **core/deus**: CLI tool for orchestrating agents

**Integration exists only between**: `core/deus` (CLI) ↔ `apps/deus` (Web UI)

---

## Integration Flow

```
┌──────────────────┐
│   User in CLI    │
└────────┬─────────┘
         │
         v
┌──────────────────────────────────────────────────┐
│              core/deus (CLI)                     │
│                                                  │
│  1. Authenticate with API key                   │
│  2. Create session                              │
│  3. Ask routing decision                        │
│  4. Sync messages                               │
│  5. Update session status                       │
└────────┬─────────────────────────────────────────┘
         │
         │ API calls (tRPC + REST)
         v
┌──────────────────────────────────────────────────┐
│              apps/deus (Web UI)                  │
│                                                  │
│  1. Verify API key (SHA-256 hash)               │
│  2. Store session in PostgreSQL                 │
│  3. Return AI routing decision                  │
│  4. Store messages in PostgreSQL                │
│  5. Display real-time updates                   │
└──────────────────────────────────────────────────┘
```

---

## Key Integration Points

### 1. Authentication (API Key)

**Flow**:
1. User generates API key in web UI (`apps/deus`)
2. Key stored as SHA-256 hash in database
3. User provides key to CLI (`core/deus`)
4. CLI includes key in Authorization header: `Bearer deus_sk_...`
5. Web UI validates key on every request

**Files**:
- CLI: `/core/deus/src/lib/api/client.ts`
- Web UI: `/apps/deus/src/app/(trpc)/api/trpc/[trpc]/route.ts`
- API: `/api/deus/src/router/api-key.ts`

---

### 2. Session Management

**Flow**:
1. CLI creates session with UUID
2. Syncs to web UI via `POST /api/trpc/session.create`
3. Web UI stores in `deus_sessions` table
4. CLI continues to sync:
   - Messages via `POST /api/trpc/session.addMessage`
   - Status updates via `POST /api/trpc/session.update`
5. Web UI displays real-time updates

**Files**:
- CLI: `/core/deus/src/lib/sync/session-sync.ts`
- API: `/api/deus/src/router/session.ts`
- Database: `/db/deus/src/schema/tables/session.ts`

---

### 3. AI Routing Decisions

**Flow**:
1. User sends message in CLI
2. CLI asks web UI: "Which agent should handle this?"
3. Request: `POST /api/chat/{orgSlug}/{sessionId}`
4. Web UI uses AI to analyze message and context
5. Web UI returns routing decision:
   ```json
   {
     "agent": "claude-code" | "codex",
     "mcpServers": ["playwright", "browserbase"],
     "reasoning": "Explanation of choice"
   }
   ```
6. CLI routes to specified agent

**Files**:
- CLI: `/core/deus/src/lib/router.ts`
- Web UI: `/apps/deus/src/app/api/chat/[orgSlug]/[sessionId]/route.ts`

---

### 4. Offline/Online Sync

**Flow**:
1. CLI queues events when web UI is unavailable
2. Auto-sync attempts every 5 seconds
3. When web UI comes back online:
   - CLI detects reconnection
   - Processes queue in order
   - Retries failed events
4. All events eventually synced

**Files**:
- CLI: `/core/deus/src/lib/sync/session-sync.ts`

---

## Testing Priority Matrix

### High Priority (Must Test)

1. **API Key Authentication**
   - Valid key works
   - Invalid key rejected
   - Expired key rejected
   - Revoked key rejected

2. **Session Creation & Sync**
   - Session created in CLI appears in web UI
   - Messages sync correctly
   - Status updates propagate

3. **AI Routing**
   - Code review → Claude Code
   - Testing → Codex + Playwright
   - Routing decisions are consistent

4. **Offline Queue**
   - Events queued when offline
   - Events sync when online
   - Order preserved

### Medium Priority (Should Test)

5. **Multi-Session**
   - Multiple concurrent sessions work
   - Sessions don't interfere

6. **Error Handling**
   - Graceful degradation on network errors
   - User-friendly error messages
   - Recovery from errors

7. **Organization Permissions**
   - API key validates organization access
   - Session access control works

### Low Priority (Nice to Test)

8. **Performance**
   - Session create < 500ms
   - Message sync < 200ms
   - AI routing < 2s

9. **Edge Cases**
   - Very long messages
   - Special characters
   - Rapid message sending

---

## Quick Start Guide

### Run Manual Tests

```bash
# 1. Start web UI
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
pnpm dev:deus

# 2. Open browser and generate API key
open http://localhost:4107

# 3. Build CLI
cd core/deus
pnpm build

# 4. Test CLI authentication
./dist/cli.js login
# Enter API key from step 2

# 5. Start session
./dist/cli.js start

# 6. Send test message
> Review the authentication code

# 7. Verify in web UI
open http://localhost:4107/org/<your-org>/sessions
```

### Run Automated Tests

```bash
# Unit tests only
pnpm test:unit

# Integration tests (requires PostgreSQL)
pnpm test:integration

# E2E tests (requires web UI running)
pnpm test:e2e

# All tests with coverage
pnpm test:coverage
```

---

## Critical Test Scenarios

### Scenario 1: Happy Path
```
✅ Generate API key
✅ Login CLI
✅ Start session
✅ Send message
✅ Get routing decision
✅ Agent processes message
✅ Response appears in web UI
✅ Complete session
```

### Scenario 2: Offline Workflow
```
✅ Start session online
✅ Go offline
✅ Send 3 messages (queued)
✅ Go back online
✅ All 3 messages sync in order
✅ No data loss
```

### Scenario 3: Error Recovery
```
✅ Invalid API key → Clear error message
✅ Network failure → Queue for retry
✅ Web UI 500 → Graceful degradation
✅ Agent spawn failure → User-friendly error
```

---

## Database Schema Reference

### Tables Used

1. **deus_sessions**
   - Stores session metadata (cwd, status, current agent)
   - Primary key: UUID

2. **deus_messages**
   - Stores all messages in sessions
   - Foreign key: session_id

3. **deus_api_keys**
   - Stores API keys (SHA-256 hashed)
   - Includes: expiry, scopes, revoked status

4. **organizations**
   - Stores organization info
   - Links to Clerk organizations

---

## Common Issues & Solutions

### Issue 1: API Key Not Working
**Symptoms**: CLI shows "Invalid API key"
**Solutions**:
1. Check key format: Must start with `deus_sk_`
2. Verify key not expired in database
3. Verify key not revoked
4. Check web UI is running on port 4107

### Issue 2: Session Not Appearing in Web UI
**Symptoms**: Session created in CLI but not visible in web UI
**Solutions**:
1. Check network connectivity
2. Verify API key has `sessions:write` scope
3. Check browser console for errors
4. Verify organization ID matches

### Issue 3: Messages Not Syncing
**Symptoms**: Messages sent in CLI don't appear in web UI
**Solutions**:
1. Check `DEBUG=1` for sync errors
2. Verify session ID is correct
3. Check database for queued events
4. Restart auto-sync: CLI restart

### Issue 4: Routing Not Working
**Symptoms**: CLI doesn't get routing decisions
**Solutions**:
1. Verify web UI is running
2. Check AI model is configured (claude-4-sonnet)
3. Verify organization has access
4. Check request logs in web UI console

---

## Metrics to Track

### Success Metrics

- **API Key Validation**: > 99% success rate
- **Session Creation**: < 500ms average
- **Message Sync**: < 200ms average
- **AI Routing**: < 2s average
- **Offline Queue**: 100% data preservation

### Error Metrics

- **API Key Errors**: < 1% of requests
- **Network Errors**: < 5% of requests (retried)
- **Sync Failures**: < 0.1% after retries
- **Agent Spawn Failures**: < 0.1%

---

## Next Steps

1. **Implement Unit Tests** (1-2 days)
   - SessionSyncService tests
   - API client tests
   - Router logic tests

2. **Add Integration Tests** (2-3 days)
   - Session API route tests
   - AI routing tests
   - Database interaction tests

3. **Set Up E2E Tests** (3-4 days)
   - Full workflow tests
   - Multi-session tests
   - Error recovery tests

4. **CI/CD Pipeline** (1 day)
   - GitHub Actions workflow
   - Automated testing on PRs
   - Coverage reporting

5. **Documentation** (1 day)
   - Update README with testing info
   - Create troubleshooting guide
   - Document test patterns

**Total Estimated Time**: 8-11 days

---

## Resources

- **Full Testing Guide**: `/TESTING.md`
- **Architecture Docs**:
  - `/apps/deus/CLAUDE.md`
  - `/core/deus/README.md`
- **Database Schema**: `/db/deus/src/schema/`
- **API Routes**: `/api/deus/src/router/`

---

## Questions?

Refer to the full testing guide (`TESTING.md`) for:
- Detailed test scenarios
- Code examples
- Mock data utilities
- CI/CD configuration
- Troubleshooting steps
