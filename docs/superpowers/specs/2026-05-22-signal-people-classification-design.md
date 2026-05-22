# Signal People Classification Design

## Context

Signals are created through the app API, stored in `lightfast_signals`, and
classified by the `classify-signal` Inngest workflow. The current classifier
decides whether a signal is actionable, but it does not create durable people
records for an organization.

The new behavior should support automation-driven discovery. For example, a
cron automation may inspect X/Twitter posts every hour and submit interesting
posts as signals. If Lightfast determines that the signal contains a durable
social or contact identity, the system should auto-create a Person for the
organization.

## Goals

- Create organization-scoped People automatically from signals.
- Only create People when a durable identity is present.
- Keep signal classification and people extraction as separate workflow stages.
- Use one durable People table for v1.
- Avoid name-only people and avoid ambiguous person creation.

## Non-Goals

- No separate person identities table in v1.
- No cross-identity merge or resolution in v1.
- No distinction between customers, team members, leads, or contacts in v1.
- No user-facing People UI is required for the first backend integration.

## Durable Identity Rule

A Person may be auto-created only when the people classifier finds at least one
durable identity from the signal context. Supported v1 identity shapes:

- Email address, such as `jeevan@somedomain.com`.
- Social handle, such as `@jeevanp` on X.
- Profile URL, such as `https://x.com/jeevanp` or a LinkedIn profile URL.
- Domain, only when the signal clearly presents the domain as the durable
  contact identity.

The workflow must not create a Person from a display name alone.

## Architecture

The pipeline has two AI stages.

1. `classify-signal` remains responsible for signal triage. Its structured
   output gains an optional persisted routing hint:

   ```ts
   people?: {
     shouldClassify: boolean;
     rationale: string;
   }
   ```

   New classifier responses should include this hint. The field remains
   optional on the stored `signal.classification.v1` schema so existing
   classified signal rows keep validating.

2. When the signal classification is persisted and `shouldClassify` is true,
   `classify-signal` emits `app/people.classification.requested`.

3. `classify-people` loads the signal, runs a dedicated people classifier, and
   upserts durable People for the organization.

This keeps the signal classifier general and lets people extraction evolve
without overloading the signal schema.

## Data Model

Add one table: `lightfast_people`.

```text
people
- id bigint primary key
- publicId varchar unique, person_<uuid>
- clerkOrgId varchar not null
- displayName varchar nullable
- identityProvider varchar not null
- identityType varchar not null
- identityValue text not null
- normalizedIdentityValue varchar not null
- identityKey varchar not null
- sourceSignalId varchar nullable
- metadata json not null
- createdAt timestamp not null
- updatedAt timestamp not null
```

Controlled values:

- `identityProvider`: `email`, `x`, `linkedin`, `github`, `website`, `unknown`.
- `identityType`: `email`, `handle`, `profile_url`, `domain`.

Indexes:

- Unique `people_public_id_uq` on `publicId`.
- Unique `people_org_identity_key_uq` on `(clerkOrgId, identityKey)`.
- Index `people_org_created_idx` on `(clerkOrgId, createdAt, id)`.

`identityKey` is a deterministic hash of provider, identity type, and normalized
identity value. The hash keeps the unique index compact and avoids relying on
long URL or email values in a unique key.

## Normalization

The workflow normalizes identities in application code before writing:

- Email: trim and lowercase.
- Handle: trim, remove a leading `@`, lowercase.
- Profile URL: parse URL, lowercase host, remove query and fragment, normalize
  trailing slash.
- Domain: lowercase host/domain value.

If normalization fails, the candidate is skipped. The people classifier can
suggest identities, but application code owns final validation and persistence.

## Upsert Behavior

For each valid candidate:

1. Compute `identityKey`.
2. Look up an existing row by `(clerkOrgId, identityKey)`.
3. If found, update lightweight fields such as `displayName`, `metadata`, and
   `updatedAt` without replacing the durable identity fields.
4. If not found, insert a new Person.

The operation is idempotent for repeated Inngest events and retries.

## Inngest Events

Add event schema:

```ts
"app/people.classification.requested": {
  clerkOrgId: string;
  signalId: string;
}
```

`signalId` is the signal public ID. The people workflow reloads the signal from
the database to avoid trusting event payloads for signal content.

## Error Handling

- If the source signal is missing, `classify-people` returns `missing`.
- If the signal is not classified yet, `classify-people` returns `skipped`.
- AI/provider failures bubble so Inngest retries the workflow.
- After retries are exhausted, the workflow logs the failure but does not mark
  the original signal as failed; signal classification already succeeded.
- Invalid or non-durable candidates are skipped, not treated as workflow
  failures.

## Testing

Follow red-green TDD during implementation:

- Contract tests for the signal classification routing hint.
- AI package tests for the people classifier output schema and prompt rules.
- DB helper tests for identity normalization, identity key generation, and
  idempotent upsert behavior.
- Inngest workflow tests verifying:
  - `classify-signal` emits `app/people.classification.requested` only when the
    routing hint is true.
  - `classify-people` loads the signal and upserts People.
  - missing or unclassified signals skip cleanly.
  - AI failures retry rather than mutating the signal status.

## Future Extensions

Later versions can add:

- A separate identities table for many identities per Person.
- Merge workflows for linking email, social handles, and profile URLs to the
  same real person.
- Person labels such as customer, prospect, teammate, or vendor.
- UI and API surfaces for organization People.
