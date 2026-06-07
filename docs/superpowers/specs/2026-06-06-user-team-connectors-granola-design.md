# User And Team Connectors With Granola Design

**Date:** 2026-06-06
**Status:** Ready for written spec review

## Summary

Lightfast will split connectors into two product categories:

- **Team connectors** are owned by the active Lightfast organization. They are
  admin-managed, shared with the workspace, and may be enabled for workspace
  agents or automations. Existing Linear and X connectors remain team
  connectors.
- **Your connectors** are owned by the signed-in user. They are private to that
  user and available only when an interactive Lightfast chat or agent session is
  acting for that same user. Granola is the first user connector.

The workspace Connectors page remains the main connector hub, but it will show
both sections so users learn the ownership model directly where they manage
connectors.

Granola is user-first and private by default. In Lightfast v1 it is available in
every interactive chat for the connected user, with a quiet source/tool
indicator when used. It is not available to teammates, org automations, team MCP
proxy tools, or shared org memory.

## Current Context

Lightfast's existing connector system is org-centered:

- `packages/connector-contract` defines connector provider ids, catalog rows,
  tool manifests, runtime tool names, and tRPC input schemas.
- `db/app/src/schema/tables/org-connectors.ts` stores one current connector per
  org/provider in `lightfast_org_connector_connections`.
- `api/app/src/services/connectors` lists org connectors, runs OAuth flows,
  refreshes tools, toggles `enabledForAutomations` and `enabledForAgents`, and
  dispatches provider runtime calls.
- `api/app/src/router/(pending-not-allowed)/connectors.ts` exposes connector
  mutations through org admin procedures.
- `packages/provider-routines` and hosted MCP proxy calls load provider routines
  from org connector connections.
- The workspace Connectors UI reads
  `org.workspace.connectors.list` and presents connectors as shared workspace
  infrastructure.

That model is right for Linear and X. It is the wrong privacy model for
Granola, because Granola meeting notes are personal meeting context. A teammate
should not get access to a user's Granola notes merely because they are in the
same Lightfast org.

Granola's current MCP integration is also per-user: each user authenticates
Granola individually, and the useful MCP behavior is personal recall and
drafting from that user's meeting history. Granola-native note sharing remains
outside the v1 Lightfast connector model.

Sources:

- [Granola MCP integration](https://docs.granola.ai/help-center/sharing/integrations/mcp)
- [Granola sharing notes](https://docs.granola.ai/help-center/sharing/sharing-notes)
- [Granola privacy FAQ](https://docs.granola.ai/help-center/consent-security-privacy/security-privacy-data-faqs)

## Product Decisions

- Granola is a **user connector**, not a team connector.
- Granola is available only to the connected Lightfast user.
- Granola is available in every interactive chat for that user once connected.
- Granola has no per-chat enablement toggle in v1.
- Granola is not available to org automations in v1.
- Granola is not exposed through the org provider routine proxy in v1.
- Granola is not ambient org memory.
- Lightfast does not use one user's Granola token to let another user view
  Granola content.
- Sharing an actual Granola note remains Granola-native unless Granola exposes
  an explicit sharing API or MCP tool in the future.

## Goals

- Teach users the difference between private user connectors and shared team
  connectors directly in the workspace Connectors page.
- Add a `Your connectors` section visible to every signed-in workspace member.
- Keep existing team connector behavior intact for Linear and X.
- Model Granola as private user-owned meeting context for interactive chats.
- Make Granola use visible after the fact with a quiet chat source/tool
  indicator.
- Keep user connector storage and runtime authorization separate from org
  connector storage and runtime authorization.
- Preserve auditability by recording the acting user and active org context when
  user connectors are used inside a workspace chat.

## Non-Goals

- No Granola access for teammates in v1.
- No Granola access for org automations in v1.
- No Granola access through hosted MCP provider routine proxy tools in v1.
- No team-wide Granola knowledge base in v1.
- No Lightfast-managed Granola note sharing in v1.
- No copied Granola note snapshots as a substitute for Granola-native sharing.
- No per-note ACL model in Lightfast.
- No per-chat Granola toggle in v1.
- No migration of existing Linear or X connector rows into a generalized owner
  table during the first Granola implementation.

## Chosen Approach

Use an explicit product and data boundary:

```text
team connector = org-owned connector connection
your connector = user-owned connector connection
```

For the first implementation, keep the existing org connector table and add a
parallel user connector model rather than refactoring all connector storage into
a generic owner table. The parallel model is lower risk because the existing org
connector system already powers setup, automation delegation, hosted MCP proxy
behavior, and provider routine ledgers.

The longer-term domain can still converge on an owner abstraction:

```text
ownerType = "org" | "user"
ownerId = clerkOrgId | clerkUserId
provider = "linear" | "x" | "granola" | ...
```

The v1 implementation should expose that concept in service types and UI copy
without forcing an early table unification.

## Workspace Connectors UX

The workspace Connectors page becomes the connector hub for both ownership
types. It should show two sections:

```text
Team connectors
Shared workspace connectors managed by admins.

Your connectors
Private connectors only you can use in chats.
```

Team connector cards:

- Show a `Team` ownership badge.
- Keep existing status, connect, reconnect, disconnect, refresh tools, and admin
  gating behavior.
- Keep `Use in agents` and `Use in automations` controls.
- Explain that enabled team connectors may be available to workspace agents or
  automations.

User connector cards:

- Show an `Only you` ownership badge.
- Are visible in the workspace Connectors page for every member.
- Are backed by the current signed-in user's connection state.
- Let the user connect, reconnect, or disconnect their own connector.
- Do not show admin-required copy.
- Do not show automation enablement.
- For Granola, show copy equivalent to:
  `Available in your chats. Not visible to teammates.`

Account settings may also link to or mirror personal connector management later,
but the workspace Connectors page is the primary place where the ownership
difference is taught.

## Chat UX

Once a user connects Granola, interactive chats may use it automatically when
the agent needs the user's meeting context.

The chat UI should show a quiet source/tool indicator when Granola was used, for
example:

```text
Used Granola
```

This indicator should not disclose Granola content to teammates by itself. It is
there so the acting user understands when private meeting context influenced an
answer.

The agent should not present Granola as team memory. The language should stay
personal:

- Good: `I found this in your Granola notes.`
- Good: `Your meeting notes mention...`
- Avoid: `The workspace knows...`
- Avoid: `The team has notes saying...`

## Backend Model

Add a user-owned connector connection model for Granola and future personal
connectors.

Recommended v1 shape:

```text
userConnectorConnections
  id
  clerkUserId
  currentUserProviderKey
  provider
  status
  connectedAt
  revokedAt
  providerAccountId
  providerAccountName
  encryptedAccessToken
  encryptedRefreshToken
  accessTokenExpiresAt
  refreshTokenExpiresAt
  scopes
  mcpEndpoint
  toolManifest
  lastToolRefreshAt
  lastToolRefreshErrorAt
  lastToolRefreshErrorCode
  metadata
  createdAt
  updatedAt
```

Use one current row per user/provider. Revoking or reconnecting should follow
the existing org connector pattern: preserve history, clear current key and
tokens on revoked rows, and insert a new active current row.

Do not add `enabledForAutomations` or `enabledForAgents` to user connectors in
v1. User connectors have a narrower fixed surface:

```text
availableForInteractiveChats = true when active
availableForAutomations = false
availableForTeamAgents = false
```

If future personal background tasks are added, introduce an explicit user-owned
surface flag then. Do not overload org automation settings.

## API And Authorization

Team connector procedures keep their current org-scoped behavior:

- Listing is available to workspace members.
- Mutations require the existing org admin gates.
- Runtime calls resolve by `clerkOrgId`.

User connector procedures should use the signed-in user identity:

- Listing resolves the current user's personal connector state.
- Mutations require only that the user is signed in.
- Runtime calls resolve by `clerkUserId`.
- Runtime calls must verify the acting chat user matches the connector owner.

When user connectors are listed inside a workspace page, the response should
combine:

```text
teamConnectors = org.workspace.connectors.list
yourConnectors = viewer/user connector list for current user
```

This may be implemented as one combined connector catalog procedure or as two
queries composed by the page. The product shape is the stable requirement: both
sections are visible together on the workspace Connectors page.

## Runtime Boundaries

Granola should have a separate runtime path from org provider routines.

Org provider routines:

```text
actor = current Lightfast user
credential owner = current Lightfast org
surfaces = hosted_mcp, native_cli, automation, chat, system
provider routine ids = linear__..., x__...
```

Granola user connector:

```text
actor = current Lightfast user
credential owner = same Lightfast user
surface = interactive_chat
provider tools = Granola MCP tools
```

The runtime must not include Granola tools when loading org connector tools for
automations or hosted MCP proxy calls.

The chat tool loader may load both:

- enabled team connector routines available to the active workspace, subject to
  existing org policies
- active user connector tools owned by the acting user, subject to user
  connector policies

The resulting tool metadata should preserve ownership so the agent and audit
logs know whether a call used team or private user credentials.

## Audit And Privacy

Every Granola tool call should record:

- acting Lightfast user id
- active Lightfast org id, when the chat is in a workspace context
- user connector connection id
- provider id
- provider tool name
- source surface: `interactive_chat`
- redacted input/output presence, not raw meeting content by default
- success or failure status

The active org id is context for where the chat happened. It is not ownership of
the Granola credential.

Audit and UI surfaces must avoid implying team access. For example, a team admin
may see that a private connector feature exists in the product, but should not
see another user's Granola connection state, account name, note titles, or call
details unless a future admin-facing policy explicitly permits it.

## Sharing Rule

The actual Granola note remains in Granola as the source of truth.

Lightfast v1 may help a user find a Granola note, answer from it, or link the
user back to Granola. It should not create a Lightfast team-visible copy of the
note as the main sharing primitive.

If a teammate needs access to the actual note, access should be granted through
Granola-native sharing. Lightfast can later orchestrate that if Granola exposes
explicit sharing APIs or MCP tools.

## Error Handling

User connector connection errors should affect only that user's connector row.
They must not put an org connector into an error state.

If Granola auth fails or expires during a chat:

- Mark the user's Granola connector as `error`.
- Suppress Granola tools for subsequent chats until reconnect.
- Show user-facing reconnect copy in the connector card.
- Let the chat continue without Granola when possible.

If a user disconnects Granola while a chat is open:

- New tool calls should fail closed.
- The UI should refresh connector state.
- Already-rendered chat messages remain as historical conversation content, but
  future Granola calls require reconnect.

## Testing

Backend tests should cover:

- user connector current-row insert, reconnect, revoke, and error transitions
- one current connection per user/provider
- no cross-user access to a user connector
- connector catalog shaping for team and user sections
- Granola tools excluded from org automation and hosted MCP provider routine
  loading
- Granola tools included for the owning user's interactive chat runtime
- audit records distinguish active org context from user credential ownership

Frontend tests should cover:

- workspace Connectors page renders `Team connectors` and `Your connectors`
- non-admin members see team connectors and their own user connectors
- user connector cards do not show admin-required copy
- user connector cards do not show automation toggles
- Granola card communicates `Only you` ownership
- connected Granola card communicates chat availability and teammate privacy

Chat tests should cover:

- connected Granola is available by default in interactive chats for the owner
- Granola is not available to a different user
- Granola usage renders a source/tool indicator
- expired or errored Granola auth does not break the rest of chat execution

## Rollout

1. Introduce the user/team connector catalog contract and UI sections without
   changing existing team connector behavior.
2. Add user connector storage and services.
3. Add Granola provider metadata and OAuth/MCP connection flow.
4. Add chat runtime loading for the acting user's Granola tools.
5. Add chat source/tool indication for Granola usage.
6. Keep automations and hosted MCP provider routine proxy unchanged for Granola.

This sequence lets Lightfast teach the ownership model before relying on it for
private meeting context.
