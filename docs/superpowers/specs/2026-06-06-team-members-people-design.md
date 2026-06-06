# Team Members People Sync Design

Date: 2026-06-06
Status: Approved for implementation planning

## Summary

Lightfast will automatically index accepted organization members into the
People surface. Clerk remains the source of truth for organization membership,
and People becomes a queryable projection that lets team members appear beside
signal-discovered people.

The v1 implementation uses scheduled Inngest reconciliation rather than Clerk
webhooks. Accepted members should appear in People within the sync window.
Pending invitations stay in Settings > Members and never create People rows.
Former members stay visible as former members so historical signal and decision
context remains intact.

## Context

People already exists as an organization-scoped workspace surface backed by
`lightfast_org_people`. Current rows are identity-centric: each row represents a
normalized durable identity such as an email address, GitHub handle, X handle,
LinkedIn profile URL, or website profile URL. Signal classification can upsert
these rows when a team-visible signal routes to People.

Organization members currently come from Clerk through the `orgMembers` router
and Settings > Members UI. That surface is for access control: invitations,
roles, removal, and pending invitations. It should remain distinct from People,
which is the workspace memory surface for humans and identities.

The missing v1 bridge is a reliable projection from accepted Clerk
memberships into People.

## Goals

- Auto-index all accepted team members into People.
- Use Clerk organization membership as the source of truth.
- Keep pending invitations out of People.
- Preserve existing signal history when a signal-discovered email becomes a
  team member.
- Retain removed or departed members as former members.
- Make team-member state queryable without hiding it in JSON metadata.
- Keep the implementation simple and idempotent by using scheduled
  reconciliation.
- Defer Clerk webhooks to a follow-up GitHub issue.

## Non-Goals

- No Clerk webhook ingestion in v1.
- No manual "Sync team members" button in v1.
- No indexing of pending invitations.
- No deletion of People rows when a member leaves.
- No full person graph or multi-identity merge model.
- No attempt to merge a member's email row with their GitHub, X, LinkedIn, or
  website identities beyond the existing identity-key behavior.
- No in-app editing of member-backed People records.

## Product Behavior

Accepted organization members appear in People automatically after the
scheduled sync runs. The canonical v1 identity for a member is their email
address represented as:

```text
identityProvider: email
identityType: email
identityValue: <member email>
```

If a signal already discovered the same normalized email, the member sync
upgrades that existing row in place. Its signal provenance remains intact:
`firstSeenSignalId`, `lastSeenSignalId`, and `seenCount` are preserved.

If a previously synced member no longer appears in Clerk's accepted membership
list, their People row stays visible and becomes a former member. Former member
status gives workspace history a stable anchor without implying current access.

If a member changes email, v1 treats that as two email identities: the old
member-backed email row becomes former, and the new email row becomes active.
True identity merging is deferred.

## Data Model

Extend `lightfast_org_people` with explicit team-member projection fields. Use
these TypeScript property names on the Drizzle schema and the corresponding
snake_case database column names:

```text
personSource: "signal" | "team_member" | "mixed"
memberStatus: "active" | "former" | null
clerkUserId: string | null
memberRole: "org:admin" | "org:member" | null
memberSyncedAt: datetime | null
```

`personSource` describes how the row entered or is used by People:

- `signal`: discovered only through signal classification.
- `team_member`: created by the team-member sync.
- `mixed`: both signal-discovered and team-member-backed.

`memberStatus` applies only to rows with member projection state:

- `active`: the user is currently an accepted Clerk organization member.
- `former`: the user was previously synced as an accepted member but is no
  longer present in Clerk's accepted membership list.
- `null`: no team-member projection applies.

New signal-created rows default to `personSource = "signal"` and no member
state. New member-created rows use `personSource = "team_member"` and
`memberStatus = "active"`. Existing signal rows upgraded by email become
`personSource = "mixed"`.

The existing organization identity-key uniqueness constraint remains the
dedupe mechanism. Member upserts use normalized email identity keys.

## Sync Architecture

Add a new Inngest cron function with id `team-member-reconciler`, exported as
`teamMemberReconciler`, and register it in `api/app/src/inngest/index.ts`.

Recommended schedule:

```text
*/15 * * * *
```

The sync is a scheduled projection, not an event stream. It should be safe to
run repeatedly and safe to retry.

### Organization Selection

The reconciler gets its org list from the namespace registry:

```text
lightfast_system_namespaces
kind = "org"
status = "active"
clerkOrgId is not null
```

Add a paginated DB helper such as `listActiveOrgNamespaceClerkOrgIds`. The cron
should process a bounded page per run, ordered by namespace id or creation time,
so it cannot scan an unbounded organization set in one invocation.

If implementation discovers legacy org-scoped data without namespace rows, add
a one-time follow-up/backfill task instead of broadening the recurring cron
source.

### Per-Org Flow

For each organization:

1. List accepted Clerk organization memberships.
2. Page through all memberships; do not assume the first 100 is complete.
3. Ignore organization invitations.
4. Convert each membership with a usable email into an email-backed People
   candidate.
5. Upsert the candidate by normalized email identity key.
6. Mark previously synced active member rows missing from the current Clerk
   membership set as `former`.
7. Return per-org counts for observability.

Display name should prefer first name plus last name, then fall back to the
email address.

Members without a usable email are skipped and counted.

### Upsert Behavior

When the member email does not exist in People:

```text
personSource = "team_member"
memberStatus = "active"
clerkUserId = <Clerk user id>
memberRole = <Clerk role>
memberSyncedAt = now
```

When the member email already exists as a signal-only row:

```text
personSource = "mixed"
memberStatus = "active"
clerkUserId = <Clerk user id>
memberRole = <Clerk role>
memberSyncedAt = now
```

When the member email already exists as a member-backed row, refresh display
name, role, status, Clerk user id, and sync timestamp.

Do not increment `seenCount` or alter signal provenance during member sync.
Signal counts remain a signal-derived measure.

### Former Member Marking

Former marking only applies to rows that were previously member-backed. The
sync must not mark arbitrary signal-only email rows as former.

An active member-backed row becomes former when its `clerkUserId` or normalized
email is absent from the latest accepted Clerk membership list for that org.

Former rows keep their identity, display name, signal provenance, and metadata.
They should retain `clerkUserId` and last known `memberRole` when available,
with `memberSyncedAt` updated to the reconciliation time.

## API Surface

The existing `org.workspace.people.list` and `org.workspace.people.get`
procedures should return the new member fields as part of the People row shape.

Add list filtering for team-member projection state:

```text
sources?: Array<"signal" | "team_member" | "mixed">
memberStatuses?: Array<"active" | "former">
```

Absent or empty arrays mean "all". The API should support:

- all people
- active team members
- former team members
- signal-discovered people
- mixed rows

Saved People views should persist `sources` and `memberStatuses` alongside the
existing provider/type filters.

## UI Surface

People keeps **All People** as the default view. Team members are visible within
that default list and can be narrowed using the existing filter/menu pattern.

Add the team-membership filters to the existing People toolbar:

- Source filter: all, signal-discovered, team members, mixed.
- Member status filter: active, former.

Add a built-in, non-deletable "Team Members" view switcher preset beside
"All People". Selecting it applies `sources = ["team_member", "mixed"]` and
`memberStatuses = ["active"]`. User-created saved views should also be able to
store the new `sources` and `memberStatuses` filters.

In the table, member-backed rows should be recognizable with a compact badge or
status treatment:

```text
Team member
Former member
```

The detail sheet should show member state when present:

- Team member or former member status.
- Role.
- Clerk-backed email identity.
- Last synced time.

Settings > Members remains the access-control surface. It continues to show
pending invitations and role-management controls. It does not get a manual sync
button in v1.

## Error Handling

- The cron is idempotent. Repeated runs must not create duplicate People rows.
- Per-org Clerk failures are logged and counted, but should not stop remaining
  orgs from syncing.
- Members without a usable email are skipped and counted.
- Former marking only affects rows with prior member projection state.
- A transient Clerk failure for an org should not mark all of that org's
  members as former. Former marking should run only after that org's membership
  list was fetched successfully.
- Email changes create a former old email row and active new email row in v1.

## Observability

The reconciler should return structured counts:

```text
orgsChecked
orgsFailed
membersSeen
membersUpserted
membersSkippedNoEmail
membersMarkedFormer
```

Per-org logs should include `clerkOrgId`, counts, and failure codes/messages
when Clerk calls fail.

## Testing Plan

DB utility tests:

- Upserts a new accepted member as an email-backed People row.
- Upgrades an existing signal-discovered email row to `mixed`.
- Refreshes an existing active member row without changing signal provenance.
- Marks missing previously synced active members as former.
- Does not mark signal-only email rows as former.
- Skips invalid or missing emails.

Workflow tests:

- Registers the cron schedule.
- Lists all Clerk membership pages.
- Ignores invitations.
- Continues syncing other orgs when one org fails.
- Does not mark former rows after a failed membership fetch.
- Returns expected result counts.

Router/UI tests:

- People list filters by source and member status.
- People table renders active and former member states.
- Detail sheet renders role and last synced time.
- Saved People views preserve the new filters.
- Pending invitations do not create People rows.

## Follow-Up GitHub Issue

Follow-up issue: [#821 Add Clerk membership webhooks for People team member
sync](https://github.com/lightfastai/lightfast/issues/821).

The issue covers:

- Clerk webhook route and signature verification.
- Handling membership created, updated, and deleted events.
- Local development setup for Clerk webhook delivery.
- Replay/idempotency behavior.
- Reusing the same member upsert and former-marking primitives from this v1
  cron sync.

Webhook support is explicitly out of scope for this v1 implementation.
