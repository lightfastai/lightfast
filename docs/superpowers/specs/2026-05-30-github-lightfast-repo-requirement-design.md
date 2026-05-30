# GitHub Lightfast Repository Requirement Design

## Context

Lightfast currently gates product access on one condition: an active
source-control binding row exists for the active Clerk organization. For GitHub,
that row proves a GitHub App organization installation was verified and bound.

The next setup requirement is more specific: after the GitHub organization is
bound, the user must create a repository named `.lightfast` in that GitHub
organization, and Lightfast must verify that the installed GitHub App can access
that repository.

This design amends the gate semantics from
`docs/superpowers/specs/2026-05-27-github-org-binding-design.md` and
`docs/superpowers/specs/2026-05-30-github-compatible-emulator-boundary-design.md`.
The existing GitHub App installation and OAuth flow remains in force.

## Decision

Represent setup as two named requirements:

```ts
type OrgSetupRequirement = "github_org" | "github_lightfast_repo";
```

The organization is `bound` only when both requirements are satisfied. There is
no separate "complete" status. `bound` is derived from the requirement list:

```ts
type OrgSetupGate = {
  bindingStatus: "bound" | "unbound";
  nextSetupRequirement: OrgSetupRequirement | null;
};
```

Derivation:

```ts
bindingStatus = nextSetupRequirement === null ? "bound" : "unbound";
```

Requirement proof:

- `github_org`: the Lightfast org has an active GitHub source-control binding
  with provider account and installation identifiers.
- `github_lightfast_repo`: the active GitHub binding metadata contains a stored
  verification proof for `<github-org>/.lightfast`, and the proof was produced
  by checking that the same GitHub App installation can access that repository.

## Setup Contract Package

Create a separate isomorphic package for Lightfast setup policy:

```text
packages/app-setup-contract/
```

Package name:

```json
"@repo/app-setup-contract"
```

This package owns Lightfast setup names and route mapping, not GitHub protocol
schemas:

```ts
export const LIGHTFAST_REPOSITORY_NAME = ".lightfast" as const;

export const ORG_SETUP_REQUIREMENTS = [
  "github_org",
  "github_lightfast_repo",
] as const;

export type OrgSetupRequirement = (typeof ORG_SETUP_REQUIREMENTS)[number];

export type OrgSetupGate = {
  bindingStatus: "bound" | "unbound";
  nextSetupRequirement: OrgSetupRequirement | null;
};
```

It should also export the repair ids and route builders used by proxy,
diagnostics, API responses, and setup UI:

```ts
export type OrgSetupRepairId =
  | "setup-github-org"
  | "setup-github-lightfast-repo";

export function repairIdForSetupRequirement(
  requirement: OrgSetupRequirement
): OrgSetupRepairId;

export function pathForSetupRequirement(input: {
  orgSlug: string;
  requirement: OrgSetupRequirement;
}): string;
```

It should also own `.lightfast` repository proof and setup error schemas:

```ts
export const githubLightfastRepositoryProofSchema = z.object({
  fullName: z.string().min(1),
  id: z.string().min(1),
  installationId: z.string().min(1),
  name: z.literal(LIGHTFAST_REPOSITORY_NAME),
  verifiedAt: z.string().datetime(),
});

export const APP_SETUP_ERROR_CODES = [
  "github_transient_error",
  "lightfast_repo_missing",
  "lightfast_repo_inaccessible",
] as const;
```

`@repo/github-app-contract` remains the GitHub provider contract package:
callback paths, GitHub bind error codes, normalized installation schemas, and
GitHub installation metadata schemas. It should not own Lightfast's setup
requirement vocabulary, `.lightfast` repository name, or `.lightfast`
repository proof schema.

## Goals

- Keep setup requirements explicit and inspectable.
- Keep `bound` as the compact derived product gate.
- Preserve the existing GitHub org binding flow.
- Add a second setup task for verifying the `.lightfast` repository.
- Let the proxy and API gates send users to the precise missing requirement.
- Use one production-shaped GitHub API check in local development and real
  GitHub.
- Keep Lightfast setup constants out of the GitHub provider contract package.
- Avoid broad GitHub permissions for automatic repository creation in v1.
- Avoid a new durable table until repository state grows beyond one proof.

## Non-Goals

- No automatic `.lightfast` repository creation in v1.
- No repository picker in Lightfast.
- No durable repository table in v1.
- No GitHub Enterprise Server endpoint matrix.
- No PAT storage or PAT-based GitHub installation editing.
- No requirement that `.lightfast` is private in v1.
- No change to the existing GitHub App installation/OAuth callback sequence.

## Gate Model

Create a single policy helper in the auth boundary, for example:

```text
api/app/src/auth/org-setup-gate.ts
```

Responsibilities:

- Load the active source-control binding for a Clerk org.
- Determine the first setup requirement that is not satisfied.
- Return the derived `OrgSetupGate`.

The helper should be the only place that derives `bindingStatus` from setup
requirements. Callers should not reimplement requirement logic.

Gate derivation must not call GitHub. It reads the DB binding and its stored
metadata only. The setup mutation writes repository proof after a GitHub check;
future webhook or reconciliation work can invalidate stale proof if the repo is
deleted or removed from the installation.

Initial requirement order lives in `@repo/app-setup-contract`:

```ts
const ORG_SETUP_REQUIREMENTS = [
  "github_org",
  "github_lightfast_repo",
] as const;
```

`nextSetupRequirement` is the first unsatisfied requirement in this order. It is
`null` only when both requirements are satisfied.

## Metadata

Add the `.lightfast` repository proof schema to `@repo/app-setup-contract`.
This is product setup metadata, not GitHub provider protocol, so
`@repo/github-app-contract` should not grow another Lightfast-specific field.

```ts
type GitHubLightfastRepositoryProof = {
  fullName: string; // "acme/.lightfast"
  id: string;
  installationId: string;
  name: typeof LIGHTFAST_REPOSITORY_NAME;
  verifiedAt: string; // ISO timestamp
};
```

Store it under the existing active binding metadata:

```ts
{
  events: string[];
  githubAppId: string;
  githubAppSlug: string | null;
  githubSetupAction?: string;
  lightfastRepository?: GitHubLightfastRepositoryProof;
  permissions: Record<string, string>;
  repositorySelection: "all" | "selected";
}
```

The proof is valid only when:

- `lightfastRepository.name === LIGHTFAST_REPOSITORY_NAME`;
- `lightfastRepository.fullName` matches the active binding's
  `providerAccountLogin`;
- `lightfastRepository.installationId` matches the active binding's
  `providerInstallationId`.

Use a generic DB helper to merge metadata into the active binding row. Do not
make `db/app` own GitHub-specific policy. The auth gate should parse the
repository proof through `@repo/app-setup-contract` while continuing to parse
base GitHub installation metadata through `@repo/github-app-contract` where
needed.

## GitHub Verification

Add a Node helper in `@repo/github-app-node`:

```ts
verifyGitHubInstallationRepository({
  apiBaseUrl,
  apiVersion,
  appJwt,
  expectedInstallationId,
  owner,
  repo,
});
```

The helper calls:

```text
GET /repos/{owner}/{repo}/installation
```

with a GitHub App JWT. It succeeds only when GitHub returns an installation
whose `id` matches `expectedInstallationId`. A 404 or mismatched installation
means `github_lightfast_repo` is still missing.

This check proves both relevant facts for v1:

- the repository exists; and
- the GitHub App installation can access it.

Selected-repository installations need special handling. If the user installed
the GitHub App on selected repositories before creating `.lightfast`, GitHub may
not grant the app access to the new repository. Lightfast should tell the user
to update the GitHub App installation to include `.lightfast`, then verify
again. V1 should not try to add that repository through the API because GitHub's
repository-to-installation edit endpoint is PAT-only.

## Setup Flow

Initial user path:

```text
/:slug/tasks/bind
  -> bind GitHub org
  -> verify and store github_org
  -> route to /:slug/tasks/github/lightfast-repo
  -> verify and store github_lightfast_repo
  -> session reload
  -> /:slug
```

Add a new setup page:

```text
/:slug/tasks/github/lightfast-repo
```

The page should:

- show that the GitHub organization is connected;
- name the required repository exactly as `.lightfast`;
- link to GitHub's new repository page for the bound organization;
- provide a "Verify repository" action;
- show actionable errors for missing repo, inaccessible repo, permission
  issues, and transient GitHub failures.

Add a setup mutation:

```ts
org.setup.github.verifyLightfastRepo
```

The mutation should:

1. Require an active Clerk session for the selected org.
2. Require org admin access.
3. Load the active GitHub binding.
4. Create a GitHub App JWT.
5. Verify `<providerAccountLogin>/.lightfast` against the binding's
   `providerInstallationId`.
6. Merge the repository proof into binding metadata.
7. Mirror the derived gate into Clerk metadata.
8. Return the new `OrgSetupGate`.

The mutation must be idempotent:

- If no repository proof exists, verify GitHub and write proof.
- If repository proof exists and matches the active binding's provider account
  and installation id, return the current gate without error.
- If repository proof exists but does not match the active binding, ignore the
  stale proof and re-run verification.

## Auth And Proxy Changes

Replace `isOrgBound()` usage in auth-facing gates with the derived setup gate:

- `api/app/src/auth/identity.ts`
- `api/app/src/auth/api-key.ts`
- `api/app/src/auth/organization-access.ts`
- `api/app/src/router/(pending-allowed)/native-auth.ts`
- `api/app/src/trpc.ts`
- `api/app/src/orpc/middleware/org-gate.ts`

Keep product procedures checking `bindingStatus === "bound"`, but derive that
value from the requirements.

Update diagnostics:

```ts
type RepairId =
  | "create-or-join-org"
  | OrgSetupRepairId;
```

When a product route is blocked, the diagnostic should use the repair id derived
from `nextSetupRequirement`.

Mirror compact state into Clerk:

```ts
lf_binding_status: "bound" | "unbound";
lf_next_setup_requirement?: "github_org" | "github_lightfast_repo";
```

When `lf_binding_status !== "bound"`, proxy routing should use
`lf_next_setup_requirement` and `pathForSetupRequirement()`:

- `github_org` -> `/:slug/tasks/bind`;
- `github_lightfast_repo` -> `/:slug/tasks/github/lightfast-repo`.

If the next requirement claim is absent or invalid while unbound, fall back to
`/:slug/tasks/bind`.

## Native And API Clients

Keep existing native/client `bindingStatus` compatibility, but derive it from
requirements. Add `nextSetupRequirement` where clients need repair routing:

```ts
{
  bindingStatus: "bound" | "unbound";
  nextSetupRequirement: OrgSetupRequirement | null;
}
```

API key and oRPC auth should use the same derived gate as tRPC. They should not
trust Clerk session claims.

## Emulator

The emulator can enforce this requirement.

The upstream GitHub emulator already supports:

- `GET /repos/:owner/:repo`;
- `POST /orgs/:org/repos`;
- `GET /repos/:owner/:repo/installation`;
- `POST /app/installations/:installation_id/access_tokens`.

The Lightfast-compatible emulator routes can keep falling through to the
upstream emulator for repository endpoints. The default seed should continue to
omit `.lightfast` so local tests exercise the missing-requirement path first.

Tests can create `.lightfast` through the emulator's org repository endpoint or
insert it directly into the emulator store for focused unit coverage.

## Error Handling

Add repository-specific setup error codes to `@repo/app-setup-contract`:

```ts
type AppSetupErrorCode =
  | "github_transient_error"
  | "lightfast_repo_missing"
  | "lightfast_repo_inaccessible";
```

Use:

- `lightfast_repo_missing` when GitHub returns 404 for
  `/repos/{org}/.lightfast/installation`;
- `lightfast_repo_inaccessible` when the repo exists but the returned
  installation id is different or the app cannot access it;
- `github_transient_error` for transport errors and 5xx responses.

For `lightfast_repo_inaccessible`, the setup UI should explain the selected-repo
installation case: the repository may exist, but the GitHub App installation
does not include it. When the binding metadata has an installation URL or id
that can be mapped to GitHub settings, the UI should link users to update the
installation and include `.lightfast`.

Do not expose GitHub access tokens, app JWTs, raw provider responses, or stack
traces in UI errors.

## Testing

Focused tests should cover:

- gate derivation with no active binding:
  `nextSetupRequirement === "github_org"`;
- gate derivation with active GitHub binding and no repository proof:
  `nextSetupRequirement === "github_lightfast_repo"`;
- gate derivation with both proofs:
  `bindingStatus === "bound"` and `nextSetupRequirement === null`;
- stale repository proof with mismatched installation id is ignored;
- repeated `verifyLightfastRepo` calls are idempotent;
- `pathForSetupRequirement()` maps both requirements to the expected setup
  routes;
- GitHub repository verifier succeeds for matching installation id;
- GitHub repository verifier fails for 404 and mismatched installation id;
- setup mutation verifies `.lightfast`, updates metadata, mirrors Clerk claims,
  and returns `bound`;
- proxy redirects unbound orgs to the route for the next missing requirement;
- tRPC, oRPC, API-key, and native auth derive the same gate;
- emulator covers missing `.lightfast`, then success after repository creation;
- selected-repository installation that excludes `.lightfast` remains unbound.

Expected focused commands:

```bash
pnpm --filter @repo/github-app-node test
pnpm --filter @repo/app-setup-contract test
pnpm --filter @repo/github-app-contract test
pnpm --filter @api/app test -- src/__tests__/org-setup-gate.test.ts src/__tests__/github-setup-flow.test.ts src/__tests__/github-setup-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/tasks/bind/page.test.tsx
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
pnpm typecheck
```

## Migration Plan

1. Create `@repo/app-setup-contract` with requirement names, gate types,
   `LIGHTFAST_REPOSITORY_NAME`, repair ids, and setup route builders.
2. Add gate derivation tests.
3. Implement `api/app/src/auth/org-setup-gate.ts`.
4. Add `.lightfast` repository proof and setup error schemas to
   `@repo/app-setup-contract`.
5. Add a generic DB metadata merge helper for active bindings.
6. Add the GitHub repository verifier to `@repo/github-app-node`.
7. Add the idempotent setup mutation that verifies `.lightfast`.
8. Mirror `lf_next_setup_requirement` into Clerk metadata.
9. Update tRPC, oRPC, API-key, native auth, and org access surfaces to use the
   derived gate.
10. Add the `.lightfast` setup page and route-specific error UI.
11. Update proxy routing for the new requirement.
12. Extend emulator tests for missing and satisfied repository requirement.
13. Run focused tests and `pnpm typecheck`.

## Success Criteria

- `github_org` and `github_lightfast_repo` are the only setup requirement names.
- Setup requirement names and route mapping live in `@repo/app-setup-contract`,
  not `@repo/github-app-contract`.
- `.lightfast` repository proof and setup error codes live in
  `@repo/app-setup-contract`, not `@repo/github-app-contract`.
- No setup state uses a separate "complete" value.
- Product access remains controlled by `bindingStatus === "bound"`.
- `bindingStatus` is derived from requirement satisfaction.
- An org with only GitHub org binding is routed to the `.lightfast` repo task.
- An org with both requirements satisfied reaches product routes.
- API, native, tRPC, oRPC, and proxy gates agree on the same derived state.
- The emulator can reproduce missing and satisfied `.lightfast` states.
- No GitHub PAT is stored or required for v1.
