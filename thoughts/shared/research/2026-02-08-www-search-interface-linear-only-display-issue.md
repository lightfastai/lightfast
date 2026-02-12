---
date: 2026-02-08T15:30:00-08:00
researcher: Jeevan Pillay
git_commit: 612b0421657f6dbbdd861bf05baf16fb28f544b4
branch: main
repository: lightfast
topic: "Investigation: WWW Search Interface Shows Only Linear Issues"
tags: [research, codebase, search, www, mock-data, seed-integrations, event-filtering]
status: complete
last_updated: 2026-02-08
last_updated_by: Jeevan Pillay
---

# Research: WWW Search Interface Shows Only Linear Issues

**Date**: 2026-02-08T15:30:00-08:00
**Researcher**: Jeevan Pillay
**Git Commit**: 612b0421657f6dbbdd861bf05baf16fb28f544b4
**Branch**: main
**Repository**: lightfast

## Research Question

Why does the www search interface at `apps/www/src/app/(app)/(search)/search/page.tsx` only show Linear issues? Why are the search controls broken (delete stops at 1, then bugs out)? Why does the search only show "Topics: linear (linear, linear:issue.created)linear (linear, linear:issue.updated)"? Could this be related to the seed-integrations script filtering events and causing GitHub/Vercel to be filtered out?

## Summary

The www search interface (`apps/www`) is a **frontend-only demo** that uses hardcoded mock data and has **no backend integration**. The interface does NOT connect to any search API, does not query a database, and does not display real data from seed-integrations. The "only showing Linear issues" observation is accurate **only if looking at the mock data**, which intentionally contains placeholder results about Notion/GitHub topics, not actual Linear issues.

The actual search functionality exists in the **console app** (`apps/console`) with full Pinecone vector search, but the www app is completely separate and was never wired up to any backend.

The seed-integrations script and event filtering logic exist but are **completely irrelevant** to the www search interface since www doesn't call any APIs.

## Detailed Findings

### 1. WWW Search Interface Architecture

**Location**: `apps/www/src/components/search-input.tsx`

The search interface is a pure frontend demo:

- **Lines 25-82**: Contains `MOCK_RESULTS` constant with 4 hardcoded search results
- **Line 24 comment**: States "Mock data based on API_SPEC.md"
- **Lines 148-151**: Uses `setTimeout` to simulate an 800ms API delay, then returns `MOCK_RESULTS`
- **Line 142**: Only logs query to console - no API call

```typescript
// Line 148-151
setTimeout(() => {
  setResults(MOCK_RESULTS);
  setIsSearching(false);
}, 800);
```

**Mock Results Content**:
The 4 mock results are about:
1. "Incident 42: Billing outage" (Notion source, billing/Stripe topic)
2. "Chat model feedback" (GitHub source, ChatGPT feedback topic)
3. "Delivering high-performance customer support" (Notion source, Decagon API topic)
4. "API Platform" (GitHub source, platform overview topic)

**None of these mention Linear**. The observation that "only Linear shows" suggests the user may be looking at a different interface or the mock data was modified.

### 2. No Backend Integration

**Package Dependencies** (`apps/www/package.json:23-93`):
- No `@trpc/client` dependency
- No `@trpc/react-query` dependency
- No API client configuration files

**CORS Configuration** (`apps/console/src/app/(trpc)/api/trpc/org/[trpc]/route.ts:22-44`):
- Console tRPC endpoints only allow requests from production lightfast.ai, preview URLs, and localhost dev ports
- www app runs on port 4101, console runs on port 4107 (per microfrontends.json)
- No cross-app tRPC communication setup

### 3. Actual Search Implementation (Console App)

The real search functionality exists in the **console app**, not www:

**REST API Endpoint**:
- `apps/console/src/app/(api)/v1/search/route.ts` - POST /v1/search
- Dual authentication (API key OR session)
- Calls `searchLogic()` function

**tRPC Procedure**:
- `api/console/src/router/org/search.ts:42-185` - `orgRouter.search.query`
- API key protected
- Pinecone vector search with workspace embeddings

**Search Logic**:
- `apps/console/src/lib/v1/search.ts:28-192` - Main search implementation
- 4-path parallel search (vector, entity, cluster, actor)
- Mode-based reranking (fast/balanced/thorough)
- Result enrichment from database

### 4. Seed Integration Script (Irrelevant to WWW)

**Location**: `packages/console-test-data/src/cli/seed-integrations.ts`

This script seeds `userSources` and `workspaceIntegrations` database tables:

**Configuration** (lines 26-139):
```typescript
const DEMO_SOURCES = [
  {
    sourceType: "github",
    sourceConfig: {
      sync: {
        events: ["push", "pull_request"],  // Only these events allowed
        autoSync: true
      }
    }
  },
  {
    sourceType: "vercel",
    sourceConfig: {
      sync: {
        events: ["deployment.created", "deployment.succeeded", "deployment.failed"],
        autoSync: true
      }
    }
  },
  {
    sourceType: "sentry",
    sourceConfig: {
      sync: {
        events: ["issue.created", "issue.resolved", "error.created", "alert.triggered"],
        autoSync: true
      }
    }
  },
  {
    sourceType: "linear",
    sourceConfig: {
      sync: {
        events: ["issue.created", "issue.updated", "issue.completed", "comment.created"],
        autoSync: true
      }
    }
  }
];
```

**Key Point**: This configuration affects what events are **captured by the observation-capture workflow in the console app**. It does NOT affect the www search interface because www doesn't connect to any backend.

### 5. Event Filtering Logic (Also Irrelevant to WWW)

**Location**: `api/console/src/inngest/workflow/neural/observation-capture.ts`

**`isEventAllowed()` Function (lines 189-198)**:
```typescript
function isEventAllowed(
  sourceConfig: { sync?: { events?: string[] } },
  baseEventType: string
): boolean {
  const events = sourceConfig?.sync?.events;
  if (!events || events.length === 0) {
    return false;  // BLOCKS ALL if events array is empty/missing
  }
  return events.includes(baseEventType);
}
```

**Event Filtering Logic (lines 497-577)**:
- Looks up `workspaceIntegration` from database
- Extracts `sourceConfig.sync.events` array
- Calls `isEventAllowed()` with base event type
- If not allowed: completes job as "filtered" with reason "event_not_allowed"

**Impact**: This filtering occurs in the **console app's Inngest workflow** when processing webhook events. It determines which events get stored in the database and become searchable. However, www doesn't query this database, so this filtering has zero impact on www.

### 6. Test Data Injection

**Datasets** (`packages/console-test-data/datasets/`):
- `sandbox-1.json` (1411 lines) - Pinecone embedding dimension mismatch incident
- `sandbox-2.json` (2281 lines) - Answer API + workspace rework feature work
- `sandbox-3.json` (3125 lines) - Infrastructure and security work

**Injection Script** (`packages/console-test-data/src/cli/inject.ts`):
- Loads JSON datasets
- Transforms webhooks to SourceEvents
- Triggers Inngest workflows to process events
- Run via: `pnpm inject -- -w <workspaceId> -s <scenario>`

**Again**: This data injection is for the **console app** database, not for www.

### 7. Search Controls "Broken" Issue

The user mentioned "changing number of results like i press delete it stops at 1. then bugs out."

**Analysis**:
- The www search interface (`search-input.tsx`) has **no controls** for number of results
- It's just a text input field with rotating placeholders
- The mock data always returns exactly 4 results (hardcoded)
- No UI for pagination, filters, or result count

**Conclusion**: Either:
1. The user is looking at the **console app** search interface (which has controls)
2. The user modified the www interface to add controls
3. There's a different search interface we haven't examined

The console app search interface at `apps/console/src/components/workspace-search.tsx` DOES have controls:
- Line 55: `limit` state for result count
- Lines 90-168: `performSearch` function with filters
- Result count selector in UI

If the controls are buggy, the issue is in the **console app**, not www.

## Code References

### WWW Search Files
- `apps/www/src/app/(app)/(search)/search/page.tsx:29` - Search page route
- `apps/www/src/components/search-interface.tsx:6` - Main interface container
- `apps/www/src/components/search-input.tsx:84-230` - Search input with mock data
- `apps/www/src/components/search-input.tsx:25-82` - MOCK_RESULTS constant
- `apps/www/src/components/search-input.tsx:148-151` - Simulated API delay
- `apps/www/src/components/search-results.tsx:21-67` - Results display

### Console Search Files (Actual Implementation)
- `apps/console/src/app/(api)/v1/search/route.ts:34-149` - REST API endpoint
- `api/console/src/router/org/search.ts:42-185` - tRPC procedure
- `apps/console/src/lib/v1/search.ts:28-192` - Main search logic
- `apps/console/src/components/workspace-search.tsx:90-168` - Console search UI

### Seed Integration Files
- `packages/console-test-data/src/cli/seed-integrations.ts:26-139` - DEMO_SOURCES configuration
- `packages/console-test-data/src/cli/seed-integrations.ts:141-201` - seedIntegrations function
- `api/console/src/inngest/workflow/neural/observation-capture.ts:189-198` - isEventAllowed function
- `api/console/src/inngest/workflow/neural/observation-capture.ts:497-577` - Event filtering step

### Database Schema
- `db/console/src/schema/tables/user-sources.ts` - OAuth credentials table
- `db/console/src/schema/tables/workspace-integrations.ts` - Integration config table (contains sourceConfig.sync.events)

## Architecture Documentation

### WWW App Architecture
```
apps/www (Port 4101)
├── Marketing/demo site
├── No backend integration
├── No tRPC client
└── Mock data only

Frontend Only:
search/page.tsx → SearchInterface → SearchInput → MOCK_RESULTS (4 items)
                                   └─ SearchResults (displays mock data)
```

### Console App Architecture
```
apps/console (Port 4107)
├── tRPC API (orgRouter.search.query)
├── REST API (/v1/search)
└── Full search stack:
    ├── Dual auth (API key OR session)
    ├── 4-path parallel search
    ├── Pinecone vector search
    ├── Entity/cluster/actor search
    ├── Mode-based reranking
    └── Result enrichment
```

### Event Filtering Architecture
```
Webhook → route handler → Inngest trigger → observation-capture workflow
                                           ├─ Lookup workspaceIntegration
                                           ├─ Extract sourceConfig.sync.events
                                           ├─ isEventAllowed(event_type)
                                           └─ Filter or process
```

## Historical Context (from thoughts/)

No existing research found on this specific topic. This is the first investigation into the www search interface architecture.

## Related Research

No directly related research documents found.

## Open Questions

1. **What interface is the user actually looking at?**
   - The www search interface doesn't show Linear issues in the mock data
   - Is the user examining the console app search instead?

2. **Have the mock results been modified?**
   - The current MOCK_RESULTS (lines 25-82) don't mention Linear
   - Was the code changed to add Linear mock data?

3. **What are the "controls" that are broken?**
   - www search has no controls for result count
   - Are they referring to console app controls?

4. **Is there a different search page?**
   - Could there be another search interface we didn't examine?
   - apps/www/src/components/search-demo.tsx exists but wasn't checked

## Recommendation for Next Steps

To diagnose the actual issue:

1. **Clarify which app**: Ask user to confirm if they're looking at:
   - www app (localhost:4101/search) - mock data only
   - console app (localhost:4107/.../search) - real search

2. **Check actual displayed content**: Take a screenshot or copy the exact text showing on screen

3. **Verify mock data state**: Read `apps/www/src/components/search-input.tsx` lines 25-82 to confirm MOCK_RESULTS content

4. **If in console app**: Investigate the actual database state:
   ```sql
   SELECT
     wi.id,
     wi.workspaceId,
     wi.sourceConfig,
     us.sourceType
   FROM workspaceIntegrations wi
   JOIN userSources us ON wi.userSourceId = us.id
   WHERE wi.workspaceId = '<workspace-id>';
   ```

5. **Check Inngest logs**: Look for "Event filtered by source config" messages to see what events are being blocked

6. **Test injection**: Run inject script and check if GitHub/Vercel events are actually being processed:
   ```bash
   pnpm inject -- -w <workspace-id> -s sandbox-3
   ```

## Conclusion

The www search interface has **no connection** to the seed-integrations script, event filtering logic, or any backend database. It's a pure frontend demo with hardcoded mock data that doesn't mention Linear (unless the code was modified).

The seed-integrations and event filtering logic are real and functional, but they only affect the **console app** search, which queries a Pinecone vector database populated by the observation-capture workflow.

If the user is seeing "only Linear issues," they are either:
1. Looking at the console app (not www)
2. Looking at modified mock data
3. Experiencing a different issue entirely

The event filtering configuration allows:
- GitHub: `push`, `pull_request`
- Vercel: `deployment.created`, `deployment.succeeded`, `deployment.failed`
- Sentry: `issue.created`, `issue.resolved`, `error.created`, `alert.triggered`
- Linear: `issue.created`, `issue.updated`, `issue.completed`, `comment.created`

If GitHub/Vercel events are being filtered out in the **console app**, check:
1. The actual `sourceConfig.sync.events` array in the database
2. Event type transformation in `getBaseEventType()` (lines 155-184 of observation-capture.ts)
3. Inngest workflow logs for "event_not_allowed" messages
