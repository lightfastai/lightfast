# Identity Context Design

Date: 2026-06-02
Status: Approved for implementation planning

## Summary

Lightfast will introduce **Identity** as a first-class organization-authored
context primitive. Identity is backed by two root files in the organization's
`.lightfast` repository:

```text
IDENTITY.md
SOUL.md
```

These files are stable company context for AI behavior. They are not memory,
not a knowledge base, and not retrieved documents. They are small,
GitHub-owned markdown files that Lightfast indexes, displays, and injects into
AI prompt construction.

Signal AI can use `IDENTITY.md` first. Future chat and agent surfaces should
consume the same runtime identity context builder when those products exist and
can include both `IDENTITY.md` and `SOUL.md`.

## Context

The current `.lightfast` repository requirement verifies that the GitHub App can
access `<github-org>/.lightfast`. Today the indexed content in that repository
is limited to `skills/**`.

Skills describe reusable agent behavior. Identity is different: it describes who
the organization is and how Lightfast AI should represent it. OpenClaw's
`SOUL.md` and `IDENTITY.md` pattern is useful here, but Lightfast should treat
the concept as global organization context rather than agent memory or general
knowledge.

The current organization settings `General` page already hosts team profile,
source-control connection, and `.lightfast` repository state. Identity belongs
there in v1 because GitHub remains the source of truth and the UI is read-only
configuration, not a live workspace surface.

## Goals

- Add **Identity** as the top-level product name for global org-authored AI
  context.
- Adopt `IDENTITY.md` and `SOUL.md` as root-level `.lightfast` repository
  conventions.
- Extend `.lightfast` repository watching so changes to those two files refresh
  Lightfast state.
- Index the two files independently from skills.
- Expose read-only Identity and Soul sections on the root organization settings
  page at `/{slug}/settings`.
- Provide one shared runtime context builder for Signal AI now and future chat
  or agent surfaces later.
- Inject only `IDENTITY.md` into Signal AI in v1.
- Track which Identity context version influenced each signal classification.
- Keep GitHub as the source of truth in v1.
- Keep Identity bounded, inspectable, and versioned by source-control commit.

## Non-Goals

- No `MEMORY.md`.
- No knowledge base.
- No embeddings, semantic search, or retrieval-augmented generation.
- No in-app markdown editor in v1.
- No AI-authored writes to `.lightfast`.
- No per-agent, per-user, per-channel, or per-workflow identity variants.
- No replacement or redesign of Skills.
- No setup gate that requires `IDENTITY.md` or `SOUL.md` to exist.
- No general-purpose markdown indexing for arbitrary `.lightfast` files.

## Product Naming

Use **Identity** for the user-facing primitive, but do not add a top-level
Workspace sidebar item or route in v1:

```text
Location: Settings > General
Route: /{slug}/settings
Settings sections: Identity, Soul
Prompt section: Organization Identity
Internal model: orgIdentity
```

The root General settings page has two new sections:

```text
Identity -> .lightfast/IDENTITY.md
Soul     -> .lightfast/SOUL.md
```

`IDENTITY.md` answers what the company or product is. `SOUL.md` answers how
Lightfast AI should sound and behave when representing the organization.
Use **Soul** as the product section label, not **Voice**, so the UI maps
directly to the repository convention.

## Repository Convention

The `.lightfast` repository shape becomes:

```text
.lightfast/
  IDENTITY.md
  SOUL.md
  skills/
    <slug>/
      SKILL.md
```

`IDENTITY.md` and `SOUL.md` are optional in v1. Missing files do not block
workspace setup, but General settings should show that the corresponding file
has not been added yet.

The setup and repository-watch configuration should include:

```ts
["skills/**", "IDENTITY.md", "SOUL.md"]
```

Existing `.lightfast` source-control repository rows should be reconciled to
include the two new root file globs. This should be done through application
logic or generated schema changes as needed; do not write manual SQL.

## File Semantics

`IDENTITY.md` is stable organization identity. It should include concise,
durable facts such as:

- what the organization or product is
- who it serves
- core product vocabulary
- important positioning or domain constraints
- facts the model should not have to infer from a single signal

`SOUL.md` is stable AI-facing voice and behavior. It should include concise
guidance such as:

- tone
- communication style
- boundaries for representation
- what the organization values in AI-written responses
- how to handle uncertainty

Both files should be treated as high-priority authored context, but not as
authoritative instructions to bypass product, safety, privacy, or tenancy rules.

Identity files are pure markdown in v1. They do not require or parse frontmatter
metadata. The file path gives the content its meaning.

Size policy:

```text
Indexing limit: 20,000 characters per file
Signal system injection budget: 4,000 characters total, IDENTITY.md only
Future chat/agent budget: larger, decided by those surface designs
```

If a file exceeds the indexing limit, store it as `too_large` and do not store
or inject its source markdown. If an indexed file fits the index but exceeds the
surface injection budget, exclude it for that runtime surface and return a
surface diagnostic. Do not silently truncate in v1.

## Data Model

Add a small Identity index parallel to the existing skill index. It should track
state for exactly the two root files, not arbitrary markdown. The lifecycle
model should be similar to Skills: one state row per `.lightfast` repository,
plus child rows for indexed content.

Create a small isomorphic contract package for shared Identity vocabulary:

```text
packages/identity-contract/
```

Package name:

```json
"@repo/identity-contract"
```

The package should own constants and schemas used across DB, API, UI, and
tests:

```ts
export const IDENTITY_FILE_NAMES = ["IDENTITY.md", "SOUL.md"] as const;
export const IDENTITY_CONTEXT_SURFACES = ["signal", "chat", "agent"] as const;

export type IdentityFileKind = "identity" | "soul";
export type IdentityFileStatus =
  | "present"
  | "missing"
  | "too_large"
  | "read_error";
export type IdentityContextSurface = "signal" | "chat" | "agent";
```

The package should not load organization state or build prompts. Runtime
loading belongs in `api/app` because it depends on DB rows, source-control
repository state, and organization scoping.

Conceptual tables:

```text
lightfast_identity_index_states
lightfast_identity_index_files
```

State rows are scoped to one `.lightfast` source-control repository and record:

- source-control repository id
- indexed commit or tree reference
- last checked commit and time
- GitHub ref ETag when available
- freshness status
- refresh lock metadata
- last successful refresh timestamp
- last failure code and message
- indexed file counts
- aggregate diagnostics

File rows record one known file each:

```ts
type IdentityFileKind = "identity" | "soul";
type IdentityFilePath = "IDENTITY.md" | "SOUL.md";
type IdentityFileStatus =
  | "present"
  | "missing"
  | "too_large"
  | "read_error";
```

Each file row should store:

- state id
- kind
- path
- status
- source markdown when present and within bounds
- content hash
- byte or character count
- last seen commit reference
- diagnostics
- timestamps

File rows should be unique by `(identityIndexStateId, kind)`. `kind` is the
semantic key (`identity` or `soul`), while `path` stores the repository
convention used for display and provenance.

Runtime diagnostics may additionally report that a present file was excluded
because it exceeded the requested surface budget. That is not a durable file
status; the durable file still remains `present`.

The index should store only these two root files. Do not persist broad
repository snapshots.

## Refresh Flow

Identity refresh uses the same verified GitHub installation and `.lightfast`
source-control repository record as skills.

Refresh should run when:

- `.lightfast` setup verifies or upserts the repository
- a `refs/heads/main` webhook indicates `IDENTITY.md` or `SOUL.md` changed
- a stale Identity state is requested by the UI or runtime context builder
- scheduled reconciliation finds a stale or never-indexed `.lightfast`
  repository
- an explicit repair or admin-triggered refresh is added later

Setup should enqueue the initial Identity refresh fire-and-forget, parallel to
the initial Skills refresh, and should not wait for indexing before returning a
bound setup gate.

Refresh behavior:

1. Resolve the current repository ref.
2. Fetch `IDENTITY.md` and `SOUL.md` from the root of the repository.
3. Store each file as `present`, `missing`, `too_large`, or `read_error`.
4. Apply a per-file size limit before storing source markdown.
5. Update the state row with the indexed ref and aggregate diagnostics.
6. Release the refresh lock.

Each successful refresh replaces both known file rows atomically as one
repository snapshot. `IDENTITY.md` and `SOUL.md` should not end up indexed from
different commits in the same Identity state.

A successful refresh should always produce two file rows, one for `identity` and
one for `soul`, even when either file is missing. Missing files are represented
as rows with `status = "missing"` rather than omitted rows.

Missing files and oversized files are normal diagnostics, not refresh failures.
Provider failures, authorization failures, repository access failures, and
unexpected storage errors are refresh failures and should preserve the previous
successful snapshot when one exists. File-level `read_error` should be reserved
for rare file-specific decoding problems after content is fetched, not for
normal GitHub/API failures.

## Webhook Fan-Out

The existing source-control webhook handler already filters pushes against the
watched path globs on the repository row and emits
`app/github.repository.push.received`.

Replace the skill-only queue workflow with a `.lightfast` index fan-out
coordinator:

```text
GitHub webhook
  -> app/github.repository.push.received
    -> queue-lightfast-index-refreshes-from-source-control
       -> if skills/** changed, send app/skills.index.refresh.requested
       -> if IDENTITY.md or SOUL.md changed, send app/identity.index.refresh.requested
       -> mark webhook delivery processed if any refresh was queued
       -> mark webhook delivery ignored only when no index applies
```

For incomplete changed-path payloads on `refs/heads/main`, the coordinator
should conservatively queue both skill and Identity refreshes.
Pushes to non-main branches are ignored in v1.

This avoids two independent workflows competing to mark one webhook delivery
status.

Identity should also have a lightweight scheduled reconciliation workflow,
parallel to Skills, that queues `app/identity.index.refresh.requested` for
enabled `.lightfast` source-control repositories with stale or missing Identity
index state.

## Runtime Context Builder

Add one shared runtime service:

```ts
getOrgIdentityContext({
  clerkOrgId,
  surface,
  maxChars,
})
```

Conceptual surface values:

```ts
type IdentityContextSurface = "signal" | "chat" | "agent";
```

The service returns structured bounded context plus metadata:

```ts
type OrgIdentityContext = {
  sections: Array<{
    title: "IDENTITY.md" | "SOUL.md";
    content: string;
    contentHash: string;
    commitSha: string | null;
  }>;
  files: Array<{
    kind: "identity" | "soul";
    path: "IDENTITY.md" | "SOUL.md";
    status: "present" | "missing" | "too_large" | "read_error";
    contentHash: string | null;
  }>;
  sourceControlRepositoryId: number | null;
  indexedCommitSha: string | null;
  diagnostics: string[];
};
```

Provide a formatter for the standard system-prompt section:

```ts
formatOrgIdentitySystemSection(context: OrgIdentityContext): string;
```

The formatted system section should be labeled `Organization Identity` and
include files in this order:

1. `IDENTITY.md`
2. `SOUL.md`

The formatter should inject the raw markdown body inside explicit file wrappers
so the model can use headings and lists without ambiguity:

```text
## Organization Identity

<identity-file path="IDENTITY.md">
# Acme

Acme builds...
</identity-file>
```

Use wrappers rather than markdown code fences so file content cannot collide
with delimiter syntax.

For `surface: "signal"`, the builder must include only `IDENTITY.md`.
`SOUL.md` remains indexed and visible in the product, but it is not injected
into Signal AI in v1. Signal AI is a classifier and router, not a general chat
session, so it should receive a compact identity budget.

For future `chat` and `agent` surfaces, the same service can include both
`IDENTITY.md` and `SOUL.md` with a larger budget without changing the
source-of-truth model.

If no injectable identity files are present, the builder should return no
sections and only metadata. Missing files, oversized files, and unreadable files
should not inject fallback text into AI prompts. They are human-visible
diagnostics, not model instructions.

The public service boundary should accept `clerkOrgId`. Internally it resolves
the active `.lightfast` source-control repository and loads the index by
`sourceControlRepositoryId`.

## Signal AI Integration

Signal AI should consume `IDENTITY.md` as bounded system-prompt context during
classification. The classifier may use Identity to interpret product
vocabulary, organization positioning, and domain-specific signals, but it must
not treat Identity as a route that writes durable knowledge.

`IDENTITY.md` is system context, but it is subordinate to Lightfast's classifier
rules. It must not override tenancy, privacy, review gates, structured output
requirements, or the rule that the signal classifier is a router rather than an
extractor. The composed system prompt should make that precedence explicit.

Signal routing rules from
`docs/superpowers/specs/2026-05-30-signal-routing-v2-design.md` still apply:

- the signal classifier remains a router, not an extractor
- future knowledge candidates must be suggestions for review only
- no direct AI writes to company knowledge
- `needs_review` remains a hard pipeline stop

Identity context should improve classification quality without changing the
visibility and review safety model.

People classification stays unchanged in v1. It should continue to consume the
signal classification and raw signal input without Identity context. Identity
can be considered for downstream classifiers in a separate design.

Identity changes apply only to new classifications. Updating `IDENTITY.md`
should not automatically reclassify existing signals. Each classified signal's
workflow-owned metadata records the Identity context used at classification
time.

## Signal Classification Provenance

When Signal AI uses `IDENTITY.md`, the workflow should durably record which
Identity context influenced the classification. This metadata is workflow-owned,
not model-owned, and should stay outside the semantic classifier output
contract.

Add narrow classification metadata to the signal persistence shape, for example:

```text
lightfast_signals.classification_metadata
```

Conceptual metadata:

```ts
type SignalClassificationMetadata = {
  identityContext: {
    includedFiles: Array<{
      path: "IDENTITY.md";
      status: "present" | "missing" | "too_large" | "read_error";
      contentHash: string | null;
      commitSha: string | null;
    }>;
    systemSectionHash: string | null;
  };
};
```

The model must not emit provenance. The classify-signal workflow attaches it
after building the system context. This keeps the persisted classification JSON
focused on routing semantics while still making Identity-influenced decisions
auditable.

A generic AI-run provenance table is out of scope for this v1. Future chat or
agent surfaces may justify a broader AI generation persistence design.

## Settings UI

Add Identity to the existing root organization settings route:

```text
/{slug}/settings
```

Do not add a new Workspace sidebar entry and do not add a separate
`/{slug}/identity` route in v1.

The existing General settings page should add two read-only sections:

```text
Identity
Soul
```

Place them after the existing `.lightfast` repository section:

```text
General
  Avatar
  Team Name
  Source Control
  .lightfast Repository
  Identity
  Soul
```

Each section should show:

- file path
- file status
- rendered markdown preview in a bordered container
- initial fixed preview height
- inline expand/collapse button to show the full wrapped markdown
- missing-file guidance
- diagnostics for oversized or unreadable files
- GitHub edit/open links when the repository and file path are known

The General page can also show shared indexed-state metadata near these
sections, such as source repository, last indexed commit, last refresh time, and
aggregate diagnostics.

File links should target the current `main` branch because they are primarily
for opening or editing the live source file in GitHub. The exact indexed commit
should be displayed separately for provenance.

The Settings UI should read Identity through a settings-scoped tRPC route:

```text
org.settings.identity.get
```

The query should return the current indexed state and file rows. If the state is
missing, stale, or never refreshed, it may opportunistically enqueue
`app/identity.index.refresh.requested`, but it should not block the response on
GitHub. Do not add a manual Refresh button in v1.

The API should return raw markdown plus metadata, not rendered HTML. The client
should render present files with the existing repository-authored markdown
renderer used by Skills:

```text
@repo/ui/components/markdown-content
```

Missing files should render explicit missing-state blocks rather than empty
markdown previews. `IDENTITY.md` missing copy should be stronger because it has
immediate Signal AI value. `SOUL.md` missing copy should be future-facing
because no v1 runtime surface consumes it yet.

The UI should not imply that Lightfast stores or edits the source of truth. The
source of truth is the GitHub `.lightfast` repository.

There should be no save button, in-app markdown editor, draft state, branch
selector, or commit flow in v1. Editing happens in GitHub.

Lightfast should not automatically create `IDENTITY.md` or `SOUL.md`. Missing
states can show suggested structure and GitHub create/open links, but the org
must author the files.

## Access Control

Identity is org-scoped. The sections should use the existing bound-org settings
access pattern.

For v1, all workspace members who can access the organization may view Identity.
Mutation permissions are not needed because Lightfast does not edit files.

Identity settings are available only after the existing workspace setup gate is
bound. If the GitHub org or `.lightfast` repository requirement is incomplete,
users should stay in the existing setup flow rather than seeing Identity
settings.

If future in-app editing is added, it should be an admin-only flow with explicit
GitHub write semantics and a separate design.

## Error Handling

Identity file states should distinguish normal absence from operational
failures:

- `missing`: file does not exist; show setup guidance
- `too_large`: file exists but exceeded the configured limit; do not inject it
- `read_error`: provider or decoding error; show diagnostic
- refresh failure: repository-level problem; preserve the last successful file
  state where possible

Oversized files should be excluded, not silently truncated. This keeps Identity
provenance clear and reinforces that these files should remain concise.

Runtime AI consumers should degrade gracefully. A missing or stale Identity
state should not block signal classification unless the source-control
repository itself is unavailable in a way that already blocks the surrounding
workflow.

The runtime builder should use stale-but-successful indexed content when a
refresh is failing or pending. It should return diagnostics that identify the
state as stale, but it should keep the previous valid content available until a
successful refresh replaces it. If no valid content has ever been indexed, the
builder returns no sections.

Signal AI must never synchronously fetch GitHub or block on an Identity refresh.
When the runtime sees missing or stale state, it may enqueue a background
refresh, but the current classification uses the current indexed snapshot and
records that provenance. The Identity UI may trigger refresh more aggressively
because a human is waiting on the page.

## Testing

Focused tests should cover:

- `.lightfast` setup/watch globs include `IDENTITY.md` and `SOUL.md`
- existing `.lightfast` repository rows can be reconciled to the new globs
- identity refresh records present, missing, oversized, and read-error files
- refresh locking and stale marking mirrors the skill-index safety model
- runtime context builder orders files as `IDENTITY.md`, then `SOUL.md`
- runtime context builder includes only `IDENTITY.md` for `surface: "signal"`
- runtime context builder can include both files for future `chat` and `agent`
  surfaces
- source-control fan-out queues skill refreshes, Identity refreshes, both, or
  neither from one webhook event
- scheduled reconciliation queues stale or missing Identity index refreshes
- signal classifier receives `IDENTITY.md` context without changing review gates
- signal classification metadata stores Identity provenance outside the
  classifier output contract
- General settings renders Identity and Soul sections from indexed file states
- Identity/Soul previews use bounded bordered markdown containers with an
  expand-full control
- app sidebar does not add a new Identity workspace item in v1

## OpenClaw Reference

OpenClaw treats files such as `SOUL.md` and `IDENTITY.md` as bootstrap/profile
context. Native Codex routing forwards them as developer-level context rather
than memory retrieval. That pattern maps well to Lightfast if Lightfast keeps
the files small, authored, versioned, and explicitly separated from memory and
knowledge.

Lightfast should borrow the high-level idea, not the entire file set. V1 only
uses `IDENTITY.md` and `SOUL.md`.

## Future Extensions

Future designs can add:

- in-app editing with GitHub commits
- previewing the final injected prompt context
- per-agent or per-channel identity variants
- human-reviewed knowledge suggestions from signals
- onboarding templates for `IDENTITY.md` and `SOUL.md`
- changelog or diff views for Identity updates

Those extensions should build on the same `orgIdentity` runtime context builder
instead of adding separate prompt assembly paths.
