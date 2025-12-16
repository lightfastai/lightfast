---
date: 2025-12-16T00:00:00+08:00
researcher: Claude
git_commit: 93499d53
branch: feat/memory-layer-foundation
repository: lightfast
topic: "API Key Implementation Audit - Schema, UI, and Best Practices Analysis"
tags: [research, codebase, api-keys, security, authentication]
status: complete
last_updated: 2025-12-16
last_updated_by: Claude
---

# Research: API Key Implementation Audit

**Date**: 2025-12-16
**Researcher**: Claude
**Git Commit**: 93499d53
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Audit the current API key implementation for both user-scoped and workspace-scoped keys:
1. Are UI implementations present for both key types?
2. What is the current key format vs requested `sk-lf-...` format?
3. Do current implementations follow industry best practices?
4. What functions exist for API key generation and validation?

## Summary

The codebase has **two API key systems** with different scopes and implementation completeness:

| Aspect | User API Keys | Workspace API Keys |
|--------|---------------|-------------------|
| **Schema** | `user-api-keys.ts` | `workspace-api-keys.ts` |
| **UI** | Full implementation | **NO UI EXISTS** |
| **Router** | `user-api-keys.ts` | `workspace-api-keys.ts` |
| **Prefix** | `lf_` | `sk_live_` |
| **Secret Length** | 32 chars | 32 chars |
| **Character Set** | `0-9a-z` (36 chars) | `0-9a-z` (36 chars) |
| **Entropy** | ~165 bits | ~165 bits |

**Key Gaps:**
1. Workspace API keys have **no UI** in org settings
2. Current prefixes don't match requested `sk-lf-...` format
3. Entropy is below industry-recommended 256 bits (using 36-char set vs 62-char)

## Detailed Findings

### 1. Database Schema

#### User API Keys (`db/console/src/schema/tables/user-api-keys.ts`)

```typescript
// Table: lightfast_user_api_keys
{
  id: varchar(191).primaryKey().$defaultFn(nanoid),  // nanoid PK
  userId: varchar(191).notNull(),                     // Clerk user ID
  name: varchar(100).notNull(),                       // User-provided name
  keyHash: text.notNull(),                            // SHA-256 hash
  keyPreview: varchar(8).notNull(),                   // Last 4 chars
  isActive: boolean.default(true),                    // Soft delete flag
  expiresAt: timestamp.optional(),
  lastUsedAt: timestamp.optional(),
  createdAt/updatedAt: timestamp
}
```

#### Workspace API Keys (`db/console/src/schema/tables/workspace-api-keys.ts`)

```typescript
// Table: lightfast_workspace_api_keys
{
  id: bigint.generatedAlwaysAsIdentity(),            // BIGINT auto-increment
  publicId: varchar(191).unique().$defaultFn(nanoid), // nanoid for external use
  workspaceId: varchar(191).references(orgWorkspaces.id).onDelete('cascade'),
  clerkOrgId: varchar(191).notNull(),                 // Denormalized for lookups
  createdByUserId: varchar(191).notNull(),            // Audit trail
  name: varchar(100).notNull(),
  keyHash: text.notNull(),                            // SHA-256 hash
  keyPrefix: varchar(20).notNull(),                   // e.g., "sk_live_"
  keySuffix: varchar(4).notNull(),                    // Last 4 chars
  isActive: boolean.default(true),
  expiresAt: timestamp.optional(),
  lastUsedAt: timestamp.optional(),
  lastUsedFromIp: varchar(45).optional(),             // IP tracking
  createdAt/updatedAt: timestamp
}
```

**Key Differences:**
- Workspace keys use BIGINT + publicId pattern (Phase 5 migration standard)
- Workspace keys track `createdByUserId` and `lastUsedFromIp` for audit
- Workspace keys store `keyPrefix` and `keySuffix` separately for display

### 2. UI Implementation Status

#### User API Keys - **FULL UI EXISTS**

Location: `apps/console/src/app/(app)/(user)/account/settings/api-key/`

```
api-key/
├── _components/
│   ├── api-key-header.tsx
│   ├── api-key-list-loading.tsx
│   ├── api-key-list.tsx        # Main interactive component
│   └── security-notice.tsx
└── page.tsx                    # Server component with prefetch
```

Features implemented:
- Create new API key (dialog with name input)
- Copy key to clipboard (only shown once on creation)
- Revoke key (soft delete)
- Delete key (hard delete)
- Display key preview (`....XXXX` format)
- Show last used timestamp

#### Workspace API Keys - **NO UI EXISTS**

Location checked: `apps/console/src/app/(app)/(org)/[slug]/settings/`

```
settings/
├── _components/
│   └── team-general-settings-client.tsx   # Team settings only
├── layout.tsx
└── page.tsx
```

**No API key management UI exists for workspace-scoped keys.** The router exists but there's no frontend implementation.

### 3. API Key Generation (`packages/console-api-key/src/crypto.ts`)

```typescript
// Constants
export const API_KEY_PREFIX = "console_sk_";     // Legacy (unused)
export const LIGHTFAST_API_KEY_PREFIX = "lf_";   // User keys
export const API_KEY_SECRET_LENGTH = 32;         // 32 characters
export const API_KEY_PREVIEW_LENGTH = 4;         // Last 4 chars

// User key generation
export function generateApiKey(prefix = API_KEY_PREFIX): string {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);  // 32 chars
  return `${prefix}${keySecret}`;
}

// Workspace key generation
export function generateWorkspaceApiKey(prefix = "sk_live_"): WorkspaceApiKeyResult {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);
  return {
    key: `${prefix}${keySecret}`,
    prefix,
    suffix: keySecret.slice(-4)
  };
}
```

**nanoid Configuration** (`packages/lib/src/nanoid.ts`):
```typescript
import { customAlphabet } from "nanoid";
export const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz");
```

**Current Character Set**: Lowercase alphanumeric only (36 chars)

### 4. Key Hashing

```typescript
// SHA-256 hashing (packages/console-api-key/src/crypto.ts)
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

### 5. Authentication Middleware

#### Workspace API Key Auth (`apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`)

- Validates `Authorization: Bearer <key>` header
- Requires key to start with `sk_` prefix
- Hashes incoming key and looks up by hash
- Checks `isActive` flag and `expiresAt`
- Updates `lastUsedAt` and `lastUsedFromIp` on each use
- Returns workspace context bound to the key (ignores `X-Workspace-ID` header)

#### Dual Auth (`apps/console/src/app/(api)/v1/lib/with-dual-auth.ts`)

- Tries API key auth first (Bearer token)
- Falls back to Clerk session auth
- Session auth requires `X-Workspace-ID` header + org membership validation

### 6. tRPC Routers

#### User API Keys Router (`api/console/src/router/user/user-api-keys.ts`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `list` | query | Returns keys without actual key values |
| `create` | mutation | Generates key with `lf_` prefix, returns plaintext once |
| `revoke` | mutation | Sets `isActive = false` |
| `delete` | mutation | Hard deletes the key |
| `rotate` | mutation | Atomically revokes old + creates new (same name) |

#### Workspace API Keys Router (`api/console/src/router/org/workspace-api-keys.ts`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `list` | query | Returns keys with `keyPrefix...keySuffix` preview |
| `create` | mutation | Generates key with `sk_live_` prefix |
| `revoke` | mutation | Sets `isActive = false` |
| `delete` | mutation | Hard deletes the key |
| `rotate` | mutation | Atomically revokes old + creates new |

All workspace mutations track activity via `recordCriticalActivity()`.

## Industry Best Practices Comparison

### Key Format Comparison

| Company | Format | Prefix | Example |
|---------|--------|--------|---------|
| **Stripe** | `{type}_{env}_...` | `sk_live_`, `pk_test_` | `sk_live_51Hqr2e...` |
| **OpenAI** | `sk-{scope}-...` | `sk-`, `sk-proj-` | `sk-proj-ABC123...` |
| **GitHub** | `{type}_...checksum` | `ghp_`, `gho_` | `ghp_AbCd...XyZ789` |
| **AWS** | `{type}...` | `AKIA`, `ASIA` | `AKIAIOSFODNN7...` |
| **Lightfast (current)** | `{prefix}...` | `lf_`, `sk_live_` | `lf_abc123...` |
| **Lightfast (requested)** | `sk-lf-...` | `sk-lf-` | `sk-lf-abc123...` |

### Entropy Analysis

| Character Set | Size | 32 chars | 40 chars | 43 chars |
|---------------|------|----------|----------|----------|
| Lowercase alphanumeric | 36 | **165 bits** | 206 bits | 222 bits |
| Full alphanumeric | 62 | 191 bits | 238 bits | **256 bits** |
| Base64 URL-safe | 64 | 192 bits | 240 bits | 258 bits |

**Current Implementation**: 32 chars × log₂(36) ≈ **165 bits** (below 256-bit recommendation)

**Recommended**: 43 chars with 62-char alphabet = **256 bits**

### Industry Recommendations Summary

1. **Prefix**: Use identifiable prefix (`sk-`, `api_`, etc.) for secret scanning
2. **Entropy**: Minimum 256 bits for production APIs
3. **Length**: 40-50 characters total (including prefix)
4. **Character Set**: Full alphanumeric (62 chars) or Base64 URL-safe (64 chars)
5. **Hashing**: SHA-256 is sufficient for high-entropy keys
6. **Rotation**: Support 90-day cycles with zero-downtime process
7. **Checksum**: Optional CRC32 for offline validation (GitHub pattern)

## Code References

- `db/console/src/schema/tables/user-api-keys.ts:27-115` - User API keys schema
- `db/console/src/schema/tables/workspace-api-keys.ts:29-157` - Workspace API keys schema
- `packages/console-api-key/src/crypto.ts:44-88` - Key generation functions
- `packages/lib/src/nanoid.ts:1-3` - nanoid configuration (36-char alphabet)
- `api/console/src/router/user/user-api-keys.ts:23-261` - User keys tRPC router
- `api/console/src/router/org/workspace-api-keys.ts:32-416` - Workspace keys tRPC router
- `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:49-183` - Auth middleware
- `apps/console/src/app/(app)/(user)/account/settings/api-key/_components/api-key-list.tsx:38-322` - User keys UI

## Implementation Status Matrix

| Component | User Keys | Workspace Keys |
|-----------|-----------|----------------|
| Database schema | Done | Done |
| tRPC router | Done | Done |
| Settings UI | Done | **MISSING** |
| Auth middleware | N/A | Done |
| Activity tracking | No | Yes |

## Open Questions

1. Should user keys and workspace keys use the same prefix format (`sk-lf-...`)?
2. Should the entropy be increased from 165 bits to 256 bits?
3. Should checksums be added for offline validation?
4. What is the migration path for existing keys if format changes?
5. Should workspace key UI be in org settings or workspace settings?
