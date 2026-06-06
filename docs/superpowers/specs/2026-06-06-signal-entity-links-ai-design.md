# Signal Entity Links AI Design

## Context

People v1 is intentionally identity-centric. `lightfast_org_people` stores one
row per durable identity, and the current people classifier refuses name-only
candidates. This is correct for a safe first version, but it means signals like
"Connect Louie with Mahesh" or "Talk to Jordi & Archer about their dev flow" do
not produce People data.

The next version should let Lightfast remember unresolved entity references and
resolve them later. If Gmail later shows that Jordi is `jordi@doccy.com.au`, old
signals that mentioned Jordi should become linked to the resolved Person without
rewriting the original signal classification JSON.

This design defines the product superstructure and scopes the first
implementation slice to the AI extraction layer.

## Goals

- Keep Signals as plain captured artifacts with raw input and classification.
- Keep signal classification JSON focused on triage, visibility, and routing.
- Add a generic entity-link layer that can support People first and Projects
  later.
- Allow name-only person references to be indexed as unresolved links.
- Automatically resolve old links when stronger identity evidence appears.
- Build the AI extraction capability first, before UI work.

## Non-Goals

- No rich text document storage for Signals in this slice.
- No Project entity implementation in this slice.
- No manual merge UI in this slice.
- No inline Signal rendering requirement in this slice. Inline links can come
  later from optional render anchors.
- No broad People UI redesign in this slice.

## Core Model

Lightfast should separate four concepts:

1. **Signal**: the source artifact, such as raw text submitted by a user, MCP
   client, automation, or connector.
2. **Classification**: triage and routing JSON for the signal.
3. **Entity**: canonical memory, such as a Person now or Project later.
4. **Entity Link**: evidence that a source artifact mentions, tags, or refers to
   an entity.

The important rule is that Entity Links are durable evidence records. Optional
text anchors are only render hints.

## Data Shape

The existing `lightfast_org_signals` table remains the Signal source of truth.

People should evolve from one row per identity toward one row per canonical
person:

```text
lightfast_org_people
- publicId
- clerkOrgId
- visibilityScope: user | team
- createdByUserId nullable
- displayName
- status: unresolved | confirmed | ambiguous
- primaryIdentityId nullable
- createdAt
- updatedAt
```

Identities attach to canonical people:

```text
lightfast_org_person_identities
- publicId
- clerkOrgId
- personPublicId
- visibilityScope: user | team
- createdByUserId nullable
- provider: email | gmail | github | x | linkedin | website
- type: email | handle | profile_url | provider_user_id
- value
- normalizedValue
- identityKey
- confidence
- sourceKind: signal | user_tag | gmail | team_member | connector
- sourceRef nullable
- metadata json
- createdAt
- updatedAt
```

Generic source-to-entity evidence lives in one link table:

```text
lightfast_org_signal_entity_links
- publicId
- clerkOrgId
- signalPublicId
- visibilityScope: user | team
- createdByUserId nullable
- entityType: person
- entityPublicId nullable
- label
- normalizedLabel
- status: unresolved | resolved | ambiguous | stale
- sourceKind: ai_extracted | user_tag | connector
- confidence
- inputHash
- anchorText nullable
- anchorOccurrence nullable
- metadata json
- createdAt
- updatedAt
```

`entityType` starts with `person`. `project` can be added later without changing
the signal storage model.

## Privacy And Visibility

Entity links must inherit visibility from their source signal or source
connector. The AI extractor does not decide sharing policy.

For the first persistence implementation:

- Team-visible signals may create org-visible unresolved people and links.
- User-visible signals may create private links for the creator, but those links
  must not make unresolved people appear in the org-wide People list.
- Needs-review signals must not create org-visible links until review is
  resolved.
- Reconciliation may use private evidence for the same user, but org-wide
  profiles should only expose org-visible evidence.

This is why the AI layer only extracts candidates. The application layer owns
visibility, persistence, and reconciliation.

## AI Layer First

Add a new AI capability:

```text
@repo/ai/signal-entity-linker
```

The workflow name will be:

```text
index-signal-entities
```

The capability receives:

```ts
{
  clerkOrgId: string;
  deploymentEnvironment: "development" | "preview" | "production";
  input: string;
  inputLength: number;
  signalId: string;
  classification: SignalClassification | null;
}
```

The classifier returns model-only candidates:

```ts
{
  schemaVersion: "signal.entity-links.v1";
  candidates: Array<{
    targetType: "person";
    label: string;
    mentionKind: "name" | "email" | "handle" | "profile_url";
    anchorText: string;
    anchorOccurrence: number;
    rationale: string;
    confidence: number;
  }>;
}
```

The model must not emit `personPublicId`, `identityKey`, or any durable database
id. It identifies text-level candidates only. Application code normalizes labels,
dedupes candidates, creates or resolves people, and writes entity links.

### Prompt Rules

The system prompt should say:

- Extract entity references from the raw signal input.
- In v1, extract only person references.
- Name-only person references are allowed.
- Emails, handles, and profile URLs are allowed when they identify a person.
- Do not browse.
- Do not infer identities that are not present in the signal.
- Do not decide whether a person is confirmed.
- Do not execute the requested action.
- Return only references that a reasonable user would expect Lightfast to
  remember as people-related context.
- Preserve uncertainty in `rationale` and `confidence`.
- `anchorText` must be an exact substring from `input`.
- `anchorOccurrence` is 1-based among exact `anchorText` matches in `input`.
- Return an empty array when no person reference is present.

This prompt intentionally differs from the current people classifier. The
current people classifier extracts durable identities. The new entity linker
extracts mention evidence.

### Example Outputs

Input:

```text
Connect Louie with Mahesh
```

Output:

```json
{
  "schemaVersion": "signal.entity-links.v1",
  "candidates": [
    {
      "targetType": "person",
      "label": "Louie",
      "mentionKind": "name",
      "anchorText": "Louie",
      "anchorOccurrence": 1,
      "rationale": "Louie appears as a person to connect.",
      "confidence": 0.76
    },
    {
      "targetType": "person",
      "label": "Mahesh",
      "mentionKind": "name",
      "anchorText": "Mahesh",
      "anchorOccurrence": 1,
      "rationale": "Mahesh appears as a person to connect.",
      "confidence": 0.76
    }
  ]
}
```

Input:

```text
Talk to Jordi & Archer about their dev flow
```

Output:

```json
{
  "schemaVersion": "signal.entity-links.v1",
  "candidates": [
    {
      "targetType": "person",
      "label": "Jordi",
      "mentionKind": "name",
      "anchorText": "Jordi",
      "anchorOccurrence": 1,
      "rationale": "Jordi appears as a person to talk with.",
      "confidence": 0.74
    },
    {
      "targetType": "person",
      "label": "Archer",
      "mentionKind": "name",
      "anchorText": "Archer",
      "anchorOccurrence": 1,
      "rationale": "Archer appears as a person to talk with.",
      "confidence": 0.74
    }
  ]
}
```

## Data Flow

The first AI-only slice can be built and tested without changing UI:

```text
signal.create
  -> stores signal as today

classify-signal
  -> stores classification as today
  -> queues app/signal.entity-index.requested

index-signal-entities
  -> loads the signal
  -> calls @repo/ai/signal-entity-linker
  -> returns candidates
```

The next persistence slice will:

```text
index-signal-entities
  -> normalize and dedupe candidates
  -> create unresolved person records as needed
  -> write signal entity links
  -> run reconciliation
```

Future connector slices will produce identity evidence:

```text
gmail.message.synced
  -> observes "Jordi Example <jordi@doccy.com.au>"
  -> upserts person identity
  -> reconciles unresolved links with normalized label "jordi"
```

## Reconciliation Rules

The reconciliation engine should be deterministic first:

- Exact identity key match always resolves to the same person.
- Exact normalized alias match may auto-resolve if there is exactly one candidate
  person in the applicable visibility scope.
- Name-only matches with multiple candidates become ambiguous, not guessed.
- Connector identity evidence can confirm a person, but source visibility still
  controls which evidence appears to which viewer.

The AI model should not perform reconciliation. It extracts text-level evidence
only.

## Signal API Shape

`signal.create` can stay unchanged for ordinary text input.

Later, a rich composer can send explicit user-authored links:

```ts
{
  input: "Talk to @Jordi about dev flow",
  links: [
    {
      entityType: "person",
      entityPublicId: "person_123",
      label: "@Jordi",
      sourceKind: "user_tag",
      anchorText: "@Jordi",
      anchorOccurrence: 1
    }
  ]
}
```

The backend still stores plain input plus normalized entity links. If a rich text
document model arrives later, it can produce the same entity-link rows.

## UI Direction

Signal detail should eventually fetch:

```ts
{
  ...signal,
  entityLinks: [...]
}
```

Inline rendering is best-effort:

- If `inputHash`, `anchorText`, and `anchorOccurrence` match the current input,
  render inline links.
- If anchor rendering fails, show entity links as "Linked context" chips below
  the signal body.
- Resolved people link to People.
- Unresolved people can open a lightweight "Needs identity" person view.

This keeps the link graph useful even if text rendering hints become stale.

## Error Handling

- Missing signals return `missing`.
- Signals with no person references return `indexed` with zero candidates.
- AI/provider failures bubble to Inngest for retry.
- Invalid candidates are skipped by application validation.
- Anchor render failures do not fail the workflow. They only affect inline UI.
- Needs-review or private visibility violations fail closed by not creating
  org-visible links.

## Testing

AI-first tests:

- Schema accepts person name, email, handle, and profile URL candidates.
- Schema rejects unsupported target types in v1.
- Prompt contains the name-only allowance and the no-inference rule.
- Request builder includes raw input and signal classification.
- Classifier stamps `signal.entity-links.v1`.
- Fixtures cover "Connect Louie with Mahesh" and "Talk to Jordi & Archer about
  their dev flow".
- Telemetry follows the existing classifier privacy posture: metadata only,
  no prompt or output recording.

Persistence tests in the next slice:

- Normalize and dedupe repeated candidates.
- Create unresolved people from name-only links.
- Write `inputHash` and anchor fields.
- Auto-resolve a unique normalized alias when identity evidence arrives.
- Mark ambiguous when multiple people share a normalized alias.
- Enforce visibility inheritance from source signal.

## Implementation Order

1. Add `@repo/ai/signal-entity-linker` schema, prompt, constants, errors, and
   request/classify functions.
2. Add unit tests and fixtures for the new AI capability.
3. Add `app/signal.entity-index.requested` event and an `index-signal-entities`
   workflow that loads signals and calls the capability.
4. Add persistence tables and DB helpers for canonical people, identities, and
   signal entity links.
5. Persist entity-link candidates and reconcile deterministic matches.
6. Extend `signals.get` to return entity links.
7. Add Signal detail UI rendering and People unresolved/confirmed UI.

The first implementation pass should stop after step 3 unless persistence is
explicitly approved for the same branch.
