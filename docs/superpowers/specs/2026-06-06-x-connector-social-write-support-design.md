# X connector social read/write support design

Date: 2026-06-06
Status: Ready for written spec review
Area: connectors, X MCP bridge, automations, provider routines

## Summary

Lightfast will expand the existing X connector from curated read-only context
tools into a broad social/account read-write connector. The first write pass
will include all user-context social/account X API operations that fit the
connector's purpose: posts, reposts, likes, bookmarks, follows, mutes, blocks,
DM/chat, lists, media, and Community Notes.

The connector will not include developer-platform or infrastructure mutation
endpoints in this pass, even though they are mutating X API endpoints. Webhooks,
compliance jobs, stream rules, account-activity subscriptions, activity
subscriptions, and connection termination belong to a separate developer
platform connector or a later design.

Write routines will be exposed through the automation provider-routine path,
which already grants automation contexts `providerRoutineWrite`. Chat and
agent-facing provider routines stay read-only unless a separate design expands
those surfaces.

## Current context

The X connector already exists as a Lightfast-hosted MCP bridge:

- `packages/x-app-node` owns X OAuth, metadata lookup, curated tool definitions,
  X API execution, and MCP client helpers for the app-hosted bridge.
- `api/app/src/services/connectors/x-flow.ts` owns org-level X OAuth lifecycle,
  token storage, tool discovery, refresh, disconnect, and access-token refresh.
- `api/app/src/services/connectors/x-mcp-bridge.ts` validates Lightfast MCP
  bearer tokens, loads the current connector row, refreshes X OAuth tokens, and
  calls X API tools.
- `api/app/src/services/connectors/runtime.ts` exposes connector MCP tools as
  automation runtime tools and records provider routine calls.
- `api/app/src/services/automations/provider-routines.ts` already allows
  automation routines with write classification and has tests for an X
  `postTweet` write routine shape.
- `packages/provider-routines` and the chat route remain agent/chat oriented.
  Chat explicitly describes connected provider routines as read-only.
- `emulators/x` covers OAuth, user lookup, and read-only post endpoints.

The previous X connector design intentionally scoped X to read-only tools
because the connector only had coarse org-level enablement. That changed with
the automation AI execution direction: automations are explicitly allowed to
use write-capable provider routines when the automation prompt requires them.

Official X sources checked for this design:

- X OAuth 2.0 Authorization Code with PKCE scopes:
  `https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code`
- X API v2 authentication mapping:
  `https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping`
- X API v2 index and OpenAPI:
  `https://docs.x.com/x-api/llms.txt`
  `https://docs.x.com/openapi.json`
- Manage Posts:
  `https://docs.x.com/x-api/posts/manage-tweets/introduction`
- Blocks:
  `https://docs.x.com/x-api/users/blocks/introduction`

## Goals

- Add all social/account user-context X write routines that are useful for
  Lightfast automations.
- Keep existing X read routines available.
- Request all OAuth scopes needed for the social/account read-write surface.
- Preserve one org-scoped X connection per Lightfast org.
- Keep raw X OAuth tokens server-side in the existing encrypted connector row.
- Keep Lightfast MCP bearer tokens as the app-hosted bridge auth boundary.
- Present write routines through automation provider routines, with routine
  classification set to `write`.
- Keep chat and agent surfaces read-only unless they are separately designed.
- Store provider routine ledger rows for every write attempt with redacted
  provider inputs and outputs.
- Make the tool implementation data-driven enough that adding or removing X
  operations is a registry edit, not a giant switch statement.
- Extend the X emulator so local tests can exercise representative write
  behavior deterministically.

## Non-goals

- No developer-platform or infrastructure X mutations in this pass:
  - webhooks;
  - stream links;
  - stream rules;
  - account activity subscriptions;
  - X activity subscriptions;
  - compliance jobs;
  - connection termination.
- No public third-party MCP client write surface.
- No raw provider payload persistence in automation run output.
- No per-tool UI toggles in the Connectors page.
- No interactive approval checkpoint before automation write routines.
- No automatic migration of already-connected X rows to broader scopes without
  admin reconnection.
- No manual SQL migration files. If implementation discovers a concrete schema
  requirement, use the repo's Drizzle generation flow.

## Chosen approach

Build an X operation registry in `@repo/x-app-node` and use it as the single
source of truth for:

- MCP tool definitions;
- OAuth scope requirements;
- read/write classification;
- HTTP method, path, query, and body mapping;
- input schemas;
- connected-user-id injection rules;
- emulator parity tests.

This replaces the current hard-coded read-only list plus `switch` URL builder
with structured operation definitions. The current read tools become registry
entries. Write tools are added as registry entries.

The bridge will execute registry operations. For tools that operate on the
authenticated account, the connected X actor id from the connector row is
injected by the bridge. The model or caller must not supply that source user id.
For example, `likePost` accepts `{ "tweet_id": "..." }`; the bridge calls
`POST /2/users/{connected_actor_id}/likes`.

## Alternatives considered

### Literal all mutating OpenAPI endpoints

This was rejected for this pass. The OpenAPI includes mutating endpoints for
webhooks, compliance jobs, stream rules, account/activity subscriptions, and
connection termination. Those are real X platform operations, but they do not
fit the current org social connector and would require different product copy,
permissions, and operational safeguards.

### Posts-only write support

This would be smaller, but it would leave the connector half-useful for
automation workflows that need engagement, account management, DMs, lists, or
media. The user explicitly chose all social/account writes.

### Generated OpenAPI-to-MCP surface

This is too broad and too blunt for the current connector. Lightfast needs
careful connected-account injection, safe descriptions, scope filtering,
classification, and exclusions. A curated registry can still be generated later
from OpenAPI, but the exposed connector surface should remain deliberate.

## OAuth scopes

X OAuth scope construction changes from a fixed read-only string:

```text
tweet.read users.read offline.access
```

to the full social/account connector scope set:

```text
tweet.read users.read offline.access
tweet.write tweet.moderate.write
follows.read follows.write
mute.read mute.write
like.read like.write
list.read list.write
block.read block.write
bookmark.read bookmark.write
dm.read dm.write
media.write
```

Scope handling requirements:

- Export a stable ordered `X_OAUTH_SCOPES` array and derive `X_OAUTH_SCOPE`
  from it for backward-compatible imports.
- Existing org X connections with only read scopes must be treated as needing
  reconnect for write routines.
- Tool discovery should only expose tools whose required scopes are present in
  the current connector row.
- If an admin reconnects and X returns fewer scopes than requested, preserve the
  returned scopes and filter tools accordingly.
- Refresh-token handling remains unchanged.

## Tool surface

The exposed social/account surface should include these groups.

### Existing read routines

- `getUsersMe`
- `getUsersByUsername`
- `getUsersByUsernames`
- `getUsersById`
- `getUsersByIds`
- `getPostsById`
- `getPostsByIds`
- `searchPostsRecent`
- `getPostsCountsRecent`

### Posts and reposts

- `createPost`
- `deletePost`
- `repostPost`
- `unrepostPost`
- `hideReply`

`createPost` supports normal post creation, replies, quote posts, edit options,
media ids, poll, reply settings, paid partnership, and related fields that the
current X API accepts. It should avoid requiring media upload in the same call;
media upload remains separate.

### Engagement

- `likePost`
- `unlikePost`
- `createBookmark`
- `deleteBookmark`

### Follows, mutes, and blocks

- `followUser`
- `unfollowUser`
- `muteUser`
- `unmuteUser`
- `blockUser`
- `unblockUser`
- `blockDms`
- `unblockDms`

Block/unblock user endpoints may require Enterprise access. They are still part
of the social/account registry, but provider failures must be returned safely
without marking the connector as auth-invalid unless the failure is truly an
auth/token failure.

### Lists

- `createList`
- `updateList`
- `deleteList`
- `addListMember`
- `removeListMember`
- `followList`
- `unfollowList`
- `pinList`
- `unpinList`

### Direct messages and chat

- `createDmConversation`
- `sendDmByParticipant`
- `sendDmByConversation`
- `deleteDmEvent`
- `createChatConversation`
- `initializeChatGroup`
- `initializeChatConversationKeys`
- `addChatGroupMembers`
- `sendChatMessage`
- `markChatConversationRead`
- `sendChatTypingIndicator`
- `addUserPublicKey`

DM and chat tools are included because they are account/social actions. They
should remain automation-only in this pass.

### Media

- `uploadMedia`
- `initializeMediaUpload`
- `appendMediaUpload`
- `finalizeMediaUpload`
- `createMediaMetadata`
- `createMediaSubtitles`
- `deleteMediaSubtitles`
- `initializeChatMediaUpload`
- `appendChatMediaUpload`
- `finalizeChatMediaUpload`

The initial implementation should support JSON-friendly media inputs. If the X
API requires multipart or binary upload bodies for a specific media endpoint,
that endpoint can be registered but marked unavailable until the connector
runtime supports binary-safe inputs. It must not fake success.

### Community Notes

- `createCommunityNote`
- `deleteCommunityNote`
- `evaluateCommunityNote`

These are account/social content actions. Provider-side plan or access failures
should be safe tool failures, not connector auth failures.

## Excluded X mutating endpoints

The following operation families are intentionally excluded from this connector
pass even if present in the OpenAPI:

- account activity webhook subscriptions;
- X activity subscriptions;
- compliance jobs;
- streaming connection termination;
- stream rule updates;
- webhook create/update/delete/validate/replay operations.

If Lightfast later needs those, use a separate design for an X developer
platform connector or an explicit "developer operations" mode.

## Backend architecture

### `packages/x-app-node`

Create an operation registry, for example:

```ts
interface XOperationDefinition {
  classification: "read" | "write";
  description: string;
  inputSchema: Record<string, unknown>;
  method: "GET" | "POST" | "PUT" | "DELETE";
  name: string;
  path: string;
  requiredScopes: string[];
  sourceUserId?: "connected_actor";
  body?: (input: Record<string, unknown>) => unknown;
  query?: (input: Record<string, unknown>) => Record<string, string | undefined>;
}
```

Implementation requirements:

- `getXToolDefinitions` returns registry entries filtered by current scopes
  when scopes are supplied.
- `executeXApiTool` executes registry operations rather than a `switch`.
- `executeXApiTool` receives the connected actor id for operations that inject
  source user id path params.
- All write operations send JSON bodies when required and set
  `Content-Type: application/json`.
- GET and DELETE operations use query/path mapping only unless the X reference
  requires a body.
- Operation input validation remains server-side and deterministic.
- Unknown tools continue to fail with a sanitized `X_TOOL_CALL_FAILED` error.
- Provider response bodies are returned as MCP `structuredContent`, but never
  logged by default.

### App-hosted X MCP bridge

`api/app/src/services/connectors/x-mcp-bridge.ts` changes:

- On `tools/list`, load the current connector row and filter registry tools by
  the row's granted scopes.
- On `tools/call`, reject calls to tools not available under the current row's
  scopes and manifest.
- Pass `connection.providerActorId` into `executeXApiTool` for source-user
  injection.
- Continue refreshing access tokens server-side before provider calls.
- Continue marking the connector `error` only on terminal token/auth failures.
- Treat plan/access/endpoint failures from X as provider tool failures, not
  connector auth failures.

### X OAuth flow

`startXConnectorOAuth` should request the full social/account scope set.

`finalizeXConnection` should persist the returned scopes and leave tool
discovery to filter against them. If the previous row had only read scopes,
reconnect should replace the current row after successful OAuth and metadata
lookup, preserving the previous manifest until discovery succeeds.

### Connector catalog

The catalog description should change from read-only wording to read/write
wording, for example:

```text
Search posts, manage engagement, send messages, and publish through X from
Lightfast automations.
```

The connector detail sheet can keep the same tool list. It should not need
per-tool toggles for this pass.

### Provider routine policy

`packages/provider-routines/src/policy.ts` should classify X write operation
names explicitly. Unknown X routines should default to
`unknown_write_default`, not read. The current `classifyXRoutine` default to
`read` is unsafe once X has broad writes.

Automation provider routines already allow write scope. Chat and generic agent
provider routines should continue to pass read-only scopes or request
`readOnly: true` so write tools are not exposed.

### Runtime and ledgers

`api/app/src/services/connectors/runtime.ts` already records provider routine
call rows and redacts inputs/outputs. The implementation should keep that path.

Requirements:

- Every automation write call must create a provider routine call row before
  provider execution.
- `providerAttempted` is set before the X bridge call.
- Success stores only redacted output presence.
- Failure stores safe error code/message.
- Provider input and output bodies are never logged or stored raw.

## Emulator

Extend `@repo/x-emulator` to support representative social/account writes:

- create/delete posts;
- repost/unrepost;
- like/unlike;
- bookmark/unbookmark;
- follow/unfollow;
- mute/unmute;
- block/unblock;
- list create/update/delete/member/follow/pin flows;
- DM send/delete and chat send/read/typing flows;
- media upload happy path;
- Community Notes happy path.

The emulator does not need to perfectly model every X side effect. It should
prove request method/path/body/auth handling and return deterministic JSON
responses that match the shape needed by provider tests.

Add failure switches for:

- generic write failure;
- auth failure;
- access or plan failure.

## Testing

Use TDD for implementation.

Focused test targets:

- `packages/x-app-node/src/__tests__/oauth.test.ts`
  - full scope string is requested;
  - returned partial scopes are preserved.
- `packages/x-app-node/src/__tests__/tools.test.ts`
  - registry includes expected social/account tools;
  - read/write classification is correct;
  - connected actor id is injected for source-user operations;
  - JSON body and query/path mapping are correct;
  - scope filtering hides tools without granted scopes;
  - unknown tools fail safely.
- `api/app/src/__tests__/connectors-x-mcp-bridge.test.ts`
  - `tools/list` filters by stored scopes;
  - write calls require matching purpose/tool MCP tokens;
  - write calls pass connected actor id;
  - provider access failures do not mark connector auth error;
  - token refresh failures still mark connector error.
- `api/app/src/__tests__/connectors-flow.test.ts`
  - X OAuth starts with full social/account scopes;
  - reconnect replaces read-only rows with broader scopes;
  - discovery filters partial granted scopes.
- `api/app/src/__tests__/connectors-runtime.test.ts`
  - write routines are callable by automations through provider routine ledger;
  - chat/system calls without automation context do not get accidental write
    exposure.
- `packages/provider-routines/src/__tests__/policy.test.ts`
  - known X writes classify as `write`;
  - unknown X routines default to `unknown_write_default`.
- `emulators/x/src/__tests__/server.test.ts`
  - representative write endpoints behave deterministically and require bearer
    auth.

After focused tests pass, run:

```bash
pnpm --filter @repo/x-app-node test
pnpm --filter @repo/provider-routines test
pnpm --filter @api/app test -- src/__tests__/connectors-x-mcp-bridge.test.ts
pnpm --filter @api/app test -- src/__tests__/connectors-flow.test.ts
pnpm --filter @api/app test -- src/__tests__/connectors-runtime.test.ts
pnpm --filter @repo/x-emulator test
```

## Rollout behavior

- Existing X connections remain connected but only have tools matching their
  stored read scopes.
- Admins must reconnect X to grant write scopes.
- Tool refresh after reconnect discovers the expanded social/account tool set.
- Automations using X can find and call write routines only when X is active,
  enabled for automations, and the relevant tool is present in the current
  manifest.
- Chat keeps using read-only instructions and should not see write routines in
  this pass.

## Open implementation notes

- Binary media upload may require a follow-up if current provider routine input
  handling cannot safely carry binary payloads. Do not silently expose a media
  upload tool that cannot execute correctly.
- Some social/account operations require X plan or Enterprise access. These
  should be exposed if they are social/account operations, but failures should
  surface as safe provider failures.
- The implementation should avoid naming churn between X docs labels and tool
  ids. Prefer current OpenAPI operation ids where they are clear, but normalize
  names where needed for caller clarity.
