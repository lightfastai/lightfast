# Manage Settings Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deeply optimize the manage settings subtree while preserving the current route structure and visible UI.

**Architecture:** Keep Next.js App Router pages as the server data orchestration boundary and keep the existing hydrated client islands. Inside each feature, split query/mutation/view-model work into focused hooks or helpers, memoize hot rows/sections, defer search filtering, and keep TanStack query keys centralized per feature.

**Tech Stack:** pnpm, TypeScript, Next.js App Router, React 19, TanStack React Query, tRPC, Clerk client hooks, Vitest, Testing Library, `@repo/ui`.

---

## Execution Notes

- The user explicitly wants continuous iteration, so execute inline after writing this plan.
- Preserve the visible UI. Do not move routes, rename navigation, or rewrite the settings layout.
- Use TDD for behavior that can regress. For performance-only refactors, add tests around the observable contracts the performance boundary depends on: stable helpers, deferred filtering behavior, optimistic cache semantics, role-gated controls, and server prefetch behavior.
- Do not add virtualization in this pass. Current members/API-key lists are bounded enough for memoized rows and deferred filtering.
- Do not stage or revert unrelated user changes. The worktree was clean before this plan except the committed design checkpoint.

## File Structure

- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-members-client.tsx`
  - Defer search input and pass stable filtered search to the list.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-list.tsx`
  - Extract query/mutation wiring into hooks, memoize rows, and stabilize callbacks.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-invite.tsx`
  - Centralize list query key construction and stabilize handlers.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list.tsx`
  - Extract revoke/delete mutation wiring, memoize row rendering, and avoid row rerenders from alert dialog state.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-create.tsx`
  - Centralize list query key construction and stabilize handlers.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-settings-client.tsx`
  - Extract billing view-model derivation, pricing hash state, cancellation mutation, and stable dialog handlers.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-sections.tsx`
  - Memoize section components that receive stable props from the billing client.
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx`
  - Stabilize query options/key usage, submit handlers, and input normalization.
- Modify: server page files under `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/**/page.tsx`
  - Construct query options once per page and keep prefetch/fetch behavior explicit.
- Modify: existing manage settings tests under `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/`
  - Add focused assertions for the new helper/hook boundaries where observable.
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-general-client.test.tsx`
  - Cover General settings slug normalization, optimistic cache update, rollback, and success navigation.

## Task 1: Members Search And Row Render Sweep

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-members-client.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-members-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-list.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-invite.tsx`

- [ ] **Step 1: Add a failing test for deferred member search wiring**

In `settings-members-client.test.tsx`, mock `useDeferredValue` without changing the other React exports:

```ts
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useDeferredValue: vi.fn((value: string) => `deferred:${value}`),
  };
});
```

Add this assertion:

```ts
it("passes deferred search input to the member list", () => {
  render(<OrgMembersClient />);

  fireEvent.change(screen.getByLabelText("Search members"), {
    target: { value: "ada" },
  });

  expect(screen.getByText("No members found")).toBeTruthy();
});
```

The test should fail before implementation because the current component passes
the immediate value and still renders Ada.

- [ ] **Step 2: Run the focused members test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-members-client.test.tsx
```

Expected: fail on the new deferred-search assertion.

- [ ] **Step 3: Implement deferred search and stable handlers**

Update `org-members-client.tsx` to use deferred search and a stable change
handler:

```tsx
import { useCallback, useDeferredValue, useState } from "react";

export function OrgMembersClient() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* existing toolbar */}
      <Input onChange={handleSearchChange} value={search} />
      <OrgMemberList searchQuery={deferredSearch} />
    </div>
  );
}
```

Keep the existing icon, aria label, placeholder, and invite button.

- [ ] **Step 4: Extract member query/mutation hooks and memoized rows**

In `org-member-list.tsx`:

- import `memo`,
- memoize `listQueryOptions`,
- extract `useOrgMemberListActions`,
- use stable callbacks returned by that hook,
- wrap `MemberRow` and `InvitationRow` in `memo`.

The hook shape should be:

```tsx
function useOrgMemberListActions({
  listQueryKey,
}: {
  listQueryKey: ReturnType<
    ReturnType<typeof useTRPC>["org"]["settings"]["orgMembers"]["list"]["queryOptions"]
  >["queryKey"];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: listQueryKey }),
    [queryClient, listQueryKey]
  );

  // move existing updateRole/remove/revokeInvitation mutations here
  // return stable updateRole/remove/revokeInvitation callbacks and actionsDisabled
}
```

Keep the current optimistic cache behavior exactly: cancel queries, write
optimistically, rollback on error, toast on success, invalidate on settled.

- [ ] **Step 5: Stabilize invite query key and handlers**

In `org-member-invite.tsx`, construct list query options once and use the
derived query key:

```tsx
const listQueryOptions = trpc.org.settings.orgMembers.list.queryOptions();
const listQueryKey = listQueryOptions.queryKey;
```

Use `useCallback` for `handleInvite` and `handleOpenChange` while preserving
the current optimistic insert, replacement, rollback, and invalidation behavior.

- [ ] **Step 6: Run the members tests and verify they pass**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-members-client.test.tsx
```

Expected: pass.

## Task 2: API Keys Row Render And Mutation Sweep

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-api-keys-client.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-create.tsx`

- [ ] **Step 1: Add a failing test for row isolation from alert dialog state**

In `settings-api-keys-client.test.tsx`, add a mocked row render counter by
asserting the row content remains managed through stable row action buttons. The
observable contract is that opening the delete confirmation does not trigger a
mutation and still keeps exactly two row action triggers:

```ts
it("keeps API key row actions stable while confirmation state changes", () => {
  render(<OrgApiKeyList />);

  screen.getAllByRole("button", { name: /^delete$/i })[0]!.click();

  expect(deleteMutateMock).not.toHaveBeenCalled();
  expect(screen.getAllByRole("button", { name: /actions/i })).toHaveLength(2);
});
```

This should pass functionally today, but keep it as a guard while extracting the
row component. If it fails because the mocked alert dialog renders all actions
eagerly, update the assertion to click the row action that opens the alert in
the existing test mock structure.

- [ ] **Step 2: Run the focused API-key test**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-api-keys-client.test.tsx
```

Expected: existing suite passes before refactor, new guard identifies the
current observable behavior.

- [ ] **Step 3: Extract API key list actions and memoized row**

In `org-api-key-list.tsx`:

- import `memo`,
- memoize or centralize `listQueryOptions` and `listQueryKey`,
- extract revoke/delete mutations into `useOrgApiKeyListActions`,
- return stable `revoke`, `deleteKey`, and `actionsDisabled`,
- move inline row JSX into `const OrgApiKeyRow = memo(function OrgApiKeyRow(...) { ... })`,
- compute `isExpired`, `isPending`, `isActive`, and `keyName` inside the row.

The row props should be stable primitives or stable callbacks:

```tsx
type OrgApiKeyRowProps = {
  actionsDisabled: boolean;
  canManageApiKeys: boolean;
  keyItem: OrgApiKey;
  onRequestDelete: (keyId: string, keyName: string) => void;
  onRequestRevoke: (keyId: string, keyName: string) => void;
  pendingDeleteKeyId?: string;
  pendingRevokeKeyId?: string;
};
```

- [ ] **Step 4: Stabilize create-dialog handlers**

In `org-api-key-create.tsx`, centralize list query options/key and wrap
`handleCreate`, `handleCopy`, and `handleOpenChange` in `useCallback`.
Preserve the stale-secret guard with `isOpenRef`.

- [ ] **Step 5: Run the API-key tests and verify they pass**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-api-keys-client.test.tsx
```

Expected: pass.

## Task 3: Billing View-Model And Section Sweep

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-billing-client.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-settings-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-sections.tsx`

- [ ] **Step 1: Add a focused derived-model assertion**

In `settings-billing-client.test.tsx`, keep existing visual/behavior tests and
add an assertion that the billing client still uses the prefetched overview and
renders the current Team plan after the view-model extraction:

```ts
it("derives billing section state from the hydrated overview", () => {
  overviewData = overview(teamItem);
  renderBilling();

  expect(suspenseQueryOptionsMock).toHaveBeenCalledWith(
    expect.objectContaining({
      queryKey: ["org", "settings", "orgBilling", "overview"],
      staleTime: 5 * 60 * 1000,
    })
  );
  expect(screen.getByText("Team")).toBeVisible();
  expect(screen.getByText("$60.00/month")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused billing test**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-billing-client.test.tsx -- -t "derives billing section state"
```

Expected: pass before refactor; this is a characterization test.

- [ ] **Step 3: Extract billing derivation and hash state**

In `billing-settings-client.tsx`, add:

```tsx
function usePricingHashDialogState() {
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const setPlanDialogOpen = useCallback((open: boolean) => {
    // move existing hash push/replace behavior here
  }, []);

  useEffect(() => {
    // move existing hashchange/popstate sync here
  }, []);

  return [isPlanDialogOpen, setPlanDialogOpen] as const;
}
```

Add a pure derivation helper:

```tsx
function deriveBillingViewModel({
  overview,
  paymentMethods,
}: {
  overview: BillingOverview;
  paymentMethods: BillingPaymentMethodResource[];
}) {
  // move existing starter/team/current/default/cancelable derivation here
}
```

Use `useMemo` around the helper in `BillingSettingsClient`.

- [ ] **Step 4: Extract cancellation mutation**

Add a focused hook in `billing-settings-client.tsx`:

```tsx
function useCancelSubscriptionItemMutation({
  overviewQueryKey,
}: {
  overviewQueryKey: ReturnType<
    ReturnType<typeof useTRPC>["org"]["settings"]["orgBilling"]["overview"]["queryOptions"]
  >["queryKey"];
}) {
  // move the existing cancel mutation here
}
```

Return the mutation object or a stable `cancelSubscriptionItem` callback.
Preserve optimistic cancellation, rollback, success cache replacement, and
settled invalidation.

- [ ] **Step 5: Memoize billing sections**

In `billing-sections.tsx`, import `memo` from React and export memoized section
components:

```tsx
export const PlanSection = memo(function PlanSection(props: PlanSectionProps) {
  // existing body
});
```

Repeat for `PaymentSection`, `InvoicesSection`, and `CancellationSection`.
Keep `LoadingLine` as a plain function.

- [ ] **Step 6: Run the billing tests and verify they pass**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-billing-client.test.tsx
```

Expected: pass.

## Task 4: General Settings And Server Page Sweep

**Files:**
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-general-client.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/page.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/page.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/page.tsx`

- [ ] **Step 1: Add General settings client tests**

Create `settings-general-client.test.tsx` with mocks for `~/trpc/react`,
`@tanstack/react-query`, `@vendor/clerk`, and `next/navigation`. Cover:

```ts
it("normalizes team slug input before save", async () => {
  render(<TeamGeneralSettingsClient slug="acme" />);
  fireEvent.change(screen.getByPlaceholderText("acme-inc"), {
    target: { value: "Acme Inc!" },
  });
  expect(screen.getByDisplayValue("acmeinc")).toBeVisible();
});

it("optimistically updates organization list cache and rolls back on error", async () => {
  render(<TeamGeneralSettingsClient slug="acme" />);
  const context = await capturedUpdateNameOptions.onMutate?.({
    slug: "acme",
    name: "acme-next",
  });
  const updated = setQueryDataMock.mock.calls.at(-1)?.[1]([
    { id: "org_1", initials: "A", slug: "acme" },
  ]);
  expect(updated[0].slug).toBe("acme-next");
  capturedUpdateNameOptions.onError?.(new Error("failed"), {
    slug: "acme",
    name: "acme-next",
  }, context);
  expect(setQueryDataMock).toHaveBeenCalledWith(
    ["viewer", "organization", "listUserOrganizations"],
    context.previousOrgs
  );
});
```

Use the actual query key returned by the test mock rather than a hard-coded
shape if the existing tRPC test helper returns a different key.

- [ ] **Step 2: Run the new General settings test and verify it fails**

Run:

```bash
pnpm --filter @lightfast/app test src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-general-client.test.tsx
```

Expected: fail until the test mocks and refactor are complete.

- [ ] **Step 3: Refactor General settings for stable query and handlers**

In `team-general-settings-client.tsx`:

- construct organization-list query options once,
- derive `orgListQueryKey` from that object,
- use `useCallback` for input normalization and submit handling,
- keep current validation, toast, optimistic cache update, `setActive`,
  `router.refresh`, and `router.push` behavior.

- [ ] **Step 4: Normalize server page query option construction**

For members, API keys, and billing page files:

```tsx
const listQueryOptions = trpc.org.settings.orgMembers.list.queryOptions();
prefetch(listQueryOptions);
```

or:

```tsx
const listQueryOptions = trpc.org.settings.orgApiKeys.list.queryOptions();
await getQueryClient().fetchQuery(listQueryOptions);
```

Keep each page's existing blocking/non-blocking behavior unless tests prove a
page can safely use `prefetch`.

- [ ] **Step 5: Run page tests and General tests**

Run:

```bash
pnpm --filter @lightfast/app test \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-general-client.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-members-page.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-api-keys-page.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-billing-page.test.tsx
```

Expected: pass.

## Task 5: Final Verification

**Files:**
- All changed files from Tasks 1-4.

- [ ] **Step 1: Run all manage settings focused tests**

Run:

```bash
pnpm --filter @lightfast/app test \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-layout.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-members-page.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-members-client.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-members-cache.test.ts \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-api-keys-page.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-api-keys-client.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-api-keys-cache.test.ts \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-billing-page.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-billing-client.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-billing-loading.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-api-keys-loading.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-members-loading.test.tsx \
  src/__tests__/app/\(app\)/\(pending-not-allowed\)/\[slug\]/settings-general-client.test.tsx
```

Expected: pass.

- [ ] **Step 2: Run app typecheck**

Run:

```bash
pnpm --filter @lightfast/app typecheck
```

Expected: pass.

- [ ] **Step 3: Inspect diff for route/UI preservation**

Run:

```bash
git diff --stat
git diff -- apps/app/src/app/\(app\)/\(pending-not-allowed\)/\[slug\]/\(workspace\)/\(manage\)/settings
```

Expected: route paths unchanged, layout/navigation labels unchanged, and no
unrelated style redesign.

- [ ] **Step 4: Commit implementation checkpoint**

Run:

```bash
git add docs/superpowers/plans/2026-05-30-manage-settings-performance.md apps/app/src
git commit -m "perf: optimize manage settings rendering"
```

Expected: commit includes only the performance plan, tests, and manage settings
implementation changes.
