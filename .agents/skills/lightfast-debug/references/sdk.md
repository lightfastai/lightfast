# SDK

Use this block when the investigation depends on connected providers or remote-system truth.

## Capability

- Lightfast search across indexed entities
- Provider discovery through proxy search
- Provider action execution through proxy calls

## Owns

- connected-provider inventory
- provider resource discovery
- remote truth from GitHub, Linear, Sentry, Vercel, Apollo, and similar systems
- comparison between Lightfast state and provider state
- debugging proxy-backed provider actions

## What To Check

- What providers and resources are connected for this org?
- Which provider action gives the fastest decisive answer?
- Does provider truth match what Lightfast thinks happened?
- Is the issue in upstream provider state, local mapping, or token and access health?
- Can semantic search surface prior related incidents, issues, PRs, or deployments?

## Exit Criteria

- The relevant provider, resource, and remote truth are identified
- The problem is localized to upstream behavior, Lightfast integration behavior, or data drift between the two

## Handoff

- Move to `runtime` when the failing behavior is in Lightfast's request or mapping logic.
- Move to `db` when provider truth needs to be compared against stored records.
- Move to `observability` when the provider interaction already has correlated error logs.
