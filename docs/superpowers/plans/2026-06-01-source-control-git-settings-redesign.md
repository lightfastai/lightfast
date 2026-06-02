# Source Control & Git Settings — UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the `/[slug]/settings/source-control` sub-tab into three stacked Connector-style sections — Organization, Lightfast repository, Repositories — splitting one ~450-line file into focused components, with one safe backend change (surface `syncStatus`).

**Architecture:** The page keeps its two suspense queries (`get`, `listRepositories`) and `HydrateClient` prefetch. The client orchestrates layout and the bound/unbound branch. Three section components (`OrganizationCard`, `LightfastRepositoryCard`, `RepositoryList`) render the connected GitHub org, the `.lightfast` repo, and the imported-repository list. `RepositoryList` composes one `RepositoryCard` per imported repo (expandable watched-paths, sync status, Open-on-GitHub) plus an extracted `AddRepositoryDialog`. A tiny shared `source-control-format.ts` holds date helpers. Everything uses locked Lightfast tokens (`bg-background`, `rounded-[8px]`/`[9px]`/`[7px]`, `h-7`, `font-mono text-[11px]`/`text-[10px]`, emerald accents).

**Tech Stack:** Next.js App Router (client components), tRPC (`useTRPC` + `useSuspenseQuery`/`useMutation`/`useQueryClient`), Clerk `useAuth`, Radix-based `@repo/ui` primitives (Dialog, DropdownMenu, Tooltip, Badge, Button), Vitest + Testing Library, Drizzle/PlanetScale (read-only here).

**Reference design spec:** `docs/superpowers/specs/2026-06-01-source-control-git-settings-redesign-design.md`

---

## Conventions for this plan

- **Commits:** This repo commits **only when the user asks** (see project memory + concurrent-git-writer note). Treat the "Commit" steps as reviewable checkpoints. When committing, ALWAYS stage with an **explicit pathspec** (`git add <exact paths>`) — never `git add -A`/`git add .` — and never push. If the user has not asked to commit, complete the step's work and leave it staged-or-unstaged for their review instead.
- **Tests run from the package dir:**
  - App: `cd apps/app && pnpm test "<filename-substring>"` (runs `vitest run <filter>`).
  - API: `cd api/app && pnpm test "<filename-substring>"`.
- **No new workspace deps.** `apps/app` does not depend on `@repo/source-control-contract`; the one literal we need (`"**"`) is inlined with a comment. The API service reuses the existing `SourceControlRepository["syncStatus"]` type — no new import.
- **Tailwind classes inline** at the JSX site (project preference). Do not hoist class strings to consts.

## File structure

New files under `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/`:

| File | Responsibility |
|------|----------------|
| `source-control-format.ts` | Pure date/string helpers (`formatStatusSubtitle`, `displayValue`) shared by the two cards. |
| `organization-card.tsx` | Connected GitHub org card + disabled "Connected ⌄" dropdown + tooltip. |
| `lightfast-repository-card.tsx` | `.lightfast` repo card — verified / unverified states. |
| `repository-card.tsx` | One imported repo: header (icon, fullName, Private/Public, sync status), expandable Watched paths, ⋯ → Open on GitHub. |
| `add-repository-dialog.tsx` | Extracted import dialog (search/select/mutate/cache-update). |
| `repository-list.tsx` | "Repositories" section header (Refresh + Add), imported-only list, empty + error states, admin gating. |

Reworked:

| File | Change |
|------|--------|
| `source-control-settings-client.tsx` | Compose the three sections; bound vs unbound branch; keep header + both queries. |
| `api/app/src/services/github/source-control/repositories.ts` | Add `syncStatus` to the row type + mapping. |

Deleted:

| File | Reason |
|------|--------|
| `_components/source-control-connection-section.tsx` | Replaced by the new components. |
| `__tests__/.../settings-source-control-connection-section.test.tsx` | Replaced by per-component tests. |

New tests under `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/`:
`settings-source-control-format.test.ts`, `settings-source-control-organization-card.test.tsx`, `settings-source-control-lightfast-repository-card.test.tsx`, `settings-source-control-repository-card.test.tsx`, `settings-source-control-add-repository-dialog.test.tsx`, `settings-source-control-repository-list.test.tsx`. Reworked: `settings-source-control-client.test.tsx`. Unchanged: `settings-source-control-page.test.tsx`.

---

## Task 1: Backend — surface `syncStatus` in the repository row

**Files:**
- Modify: `api/app/src/services/github/source-control/repositories.ts`
- Test: `api/app/src/services/github/source-control/repositories.test.ts`

- [ ] **Step 1: Update the failing test to expect `syncStatus`**

In `repositories.test.ts`, the "merges live GitHub repositories with watched rows and excludes .lightfast" assertion currently expects an object without `syncStatus`. Update the expected array so the merged row carries the watched row's sync status. Replace the existing `.toEqual([...])` block (lines ~128–138) with:

```ts
    ).toEqual([
      {
        fullName: "acme/workspace",
        id: "200",
        imported: true,
        name: "workspace",
        owner: { id: "20", login: "acme" },
        private: true,
        syncStatus: "disabled",
        watchedPathGlobs: ["**"],
      },
    ]);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd api/app && pnpm test "repositories"`
Expected: FAIL — received object is missing the `syncStatus` key (`toEqual` mismatch).

- [ ] **Step 3: Add `syncStatus` to the row type**

In `repositories.ts`, extend the `SourceControlRepositoryRow` interface (reuse the DB type already imported as `SourceControlRepository` — no new import):

```ts
export interface SourceControlRepositoryRow {
  fullName: string;
  id: string;
  imported: boolean;
  name: string;
  owner: {
    id: string;
    login: string;
  };
  private: boolean;
  syncStatus: SourceControlRepository["syncStatus"];
  watchedPathGlobs: string[] | null;
}
```

- [ ] **Step 4: Map `syncStatus` in `buildSourceControlRepositoryResponse`**

In the `.map((repository) => { ... })` return object (inside `buildSourceControlRepositoryResponse`), add the `syncStatus` field. The full returned object becomes:

```ts
      return {
        fullName: repository.fullName,
        id: repository.id,
        imported: Boolean(watched),
        name: repository.name,
        owner: {
          id: repository.ownerId,
          login: repository.ownerLogin,
        },
        private: repository.private,
        syncStatus: watched?.syncStatus ?? "disabled",
        watchedPathGlobs: watched?.watchedPathGlobs ?? null,
      };
```

- [ ] **Step 5: Run the service test to verify it passes**

Run: `cd api/app && pnpm test "repositories"`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck the API package**

Run: `pnpm --filter @api/app build`
Expected: success (the `org.settings.sourceControl.listRepositories` output type now includes `syncStatus`, which the frontend will consume).

- [ ] **Step 7: Commit (checkpoint — see Conventions)**

```bash
git add "api/app/src/services/github/source-control/repositories.ts" "api/app/src/services/github/source-control/repositories.test.ts"
git commit -m "feat(source-control): surface repository syncStatus in list payload"
```

---

## Task 2: Shared date helpers (`source-control-format.ts`)

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-format.ts`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `settings-source-control-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

const { displayValue, formatStatusSubtitle } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-format"
);

describe("source-control-format", () => {
  it("prefixes the verb and formats a valid date", () => {
    expect(
      formatStatusSubtitle("Connected on", new Date("2026-06-01T00:00:00.000Z"))
    ).toMatch(/^Connected on /);
  });

  it("returns null for an invalid date", () => {
    expect(formatStatusSubtitle("Verified", new Date(Number.NaN))).toBeNull();
  });

  it("falls back to a placeholder for empty values", () => {
    expect(displayValue(null)).toBe("Not available");
    expect(displayValue("  ")).toBe("Not available");
    expect(displayValue("acme")).toBe("acme");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm test "settings-source-control-format"`
Expected: FAIL — cannot resolve the `source-control-format` module.

- [ ] **Step 3: Create the module**

Create `source-control-format.ts`:

```ts
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function displayValue(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Not available";
}

export function formatStatusSubtitle(verb: string, value: Date): string | null {
  if (!isValidDate(value)) {
    return null;
  }
  return `${verb} ${shortDateFormatter.format(value)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm test "settings-source-control-format"`
Expected: PASS.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-format.ts" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-format.test.ts"
git commit -m "feat(source-control): add shared settings date helpers"
```

---

## Task 3: `OrganizationCard`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/organization-card.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-organization-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `settings-source-control-organization-card.test.tsx`. The test mocks the DropdownMenu and Tooltip primitives so the menu contents render inline (mirrors how the existing source-control test mocks `dialog`):

```tsx
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    disabled,
  }: {
    children?: ReactNode;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const { OrganizationCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/organization-card"
);

const connection = {
  accountLogin: "acme-live",
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 1,
  lightfastRepository: {
    fullName: "acme-live/.lightfast",
    id: "301",
    verifiedAt: new Date("2026-05-29T01:02:03.000Z"),
  },
  provider: "github" as const,
  providerLabel: "GitHub",
};

describe("OrganizationCard", () => {
  it("shows the connected org login and a connected-on subtitle", () => {
    render(<OrganizationCard connection={connection} />);

    expect(screen.getByText("acme-live")).toBeVisible();
    expect(screen.getByText(/^Connected on /)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Connected/ })
    ).toBeInTheDocument();
  });

  it("renders disabled Configure and Disconnect actions with an explanatory tooltip", () => {
    render(<OrganizationCard connection={connection} />);

    expect(
      screen.getByRole("button", { name: "Configure in GitHub" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Disconnect" })
    ).toBeDisabled();
    expect(
      screen.getByText("Connection is set up once and can't be disconnected.")
    ).toBeInTheDocument();
  });

  it("falls back to a placeholder when the account login is missing", () => {
    render(
      <OrganizationCard connection={{ ...connection, accountLogin: null }} />
    );

    expect(screen.getByText("Not available")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm test "settings-source-control-organization-card"`
Expected: FAIL — cannot resolve the `organization-card` module.

- [ ] **Step 3: Create the component**

Create `organization-card.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { ChevronDown, Settings, Unplug } from "lucide-react";
import { displayValue, formatStatusSubtitle } from "./source-control-format";

type SourceControlConnection = NonNullable<
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"]
>;

const DISCONNECT_TOOLTIP =
  "Connection is set up once and can't be disconnected.";

export function OrganizationCard({
  connection,
}: {
  connection: SourceControlConnection;
}) {
  const subtitle = formatStatusSubtitle("Connected on", connection.connectedAt);

  return (
    <section className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-background p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-input bg-background">
          <Icons.github aria-hidden="true" className="size-4 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-foreground text-sm">
            {displayValue(connection.accountLogin)}
          </p>
          {subtitle ? (
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-7 rounded-[9px]"
            size="sm"
            type="button"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-emerald-500"
            />
            Connected
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem disabled>
                  <Settings aria-hidden="true" className="size-4" />
                  Configure in GitHub
                </DropdownMenuItem>
                <DropdownMenuItem disabled variant="destructive">
                  <Unplug aria-hidden="true" className="size-4" />
                  Disconnect
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent>{DISCONNECT_TOOLTIP}</TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm test "settings-source-control-organization-card"`
Expected: PASS.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/organization-card.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-organization-card.test.tsx"
git commit -m "feat(source-control): add Organization card with disabled connection menu"
```

---

## Task 4: `LightfastRepositoryCard`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/lightfast-repository-card.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-lightfast-repository-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `settings-source-control-lightfast-repository-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const { LightfastRepositoryCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/lightfast-repository-card"
);

const baseConnection = {
  accountLogin: "acme-live",
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 1,
  provider: "github" as const,
  providerLabel: "GitHub",
};

describe("LightfastRepositoryCard", () => {
  it("renders the verified repository with a Verified badge and date", () => {
    render(
      <LightfastRepositoryCard
        connection={{
          ...baseConnection,
          lightfastRepository: {
            fullName: "acme-live/.lightfast",
            id: "301",
            verifiedAt: new Date("2026-05-30T10:00:00.000Z"),
          },
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("acme-live/.lightfast")).toBeVisible();
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText(/^Verified /)).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to repo setup when the repository is not yet verified", () => {
    render(
      <LightfastRepositoryCard
        connection={{ ...baseConnection, lightfastRepository: null }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("acme-live/.lightfast")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/github/lightfast-repo"
    );
  });

  it("keeps the Verified badge but drops the subtitle for an invalid date", () => {
    render(
      <LightfastRepositoryCard
        connection={{
          ...baseConnection,
          lightfastRepository: {
            fullName: "acme-live/.lightfast",
            id: "301",
            verifiedAt: new Date(Number.NaN),
          },
        }}
        orgSlug="acme"
      />
    );

    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.queryByText(/^Verified /)).toBeNull();
    expect(
      screen.getByText(
        "The repository Lightfast uses to coordinate workspace automation."
      )
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm test "settings-source-control-lightfast-repository-card"`
Expected: FAIL — cannot resolve the `lightfast-repository-card` module.

- [ ] **Step 3: Create the component**

Create `lightfast-repository-card.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/app-setup-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { formatStatusSubtitle } from "./source-control-format";

type SourceControlConnection = NonNullable<
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"]
>;

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:text-emerald-300">
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function LightfastRepositoryCard({
  connection,
  orgSlug,
}: {
  connection: SourceControlConnection;
  orgSlug: string;
}) {
  const repository = connection.lightfastRepository;
  const name = repository
    ? repository.fullName
    : `${connection.accountLogin}/${LIGHTFAST_REPOSITORY_NAME}`;
  const description = repository
    ? "The repository Lightfast uses to coordinate workspace automation."
    : `Create and verify the ${LIGHTFAST_REPOSITORY_NAME} repository to unlock workspace automation.`;
  const subtitle = repository
    ? formatStatusSubtitle("Verified", repository.verifiedAt)
    : null;

  return (
    <section className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-background p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-input bg-background">
          <Icons.logoShort
            aria-hidden="true"
            className="size-4 text-foreground"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-mono text-foreground text-sm">{name}</p>
          <p className="text-muted-foreground text-xs">
            {subtitle ?? description}
          </p>
        </div>
      </div>

      {repository ? (
        <StatusBadge label="Verified" />
      ) : (
        <Button
          asChild
          className="h-7 rounded-[9px]"
          size="sm"
          variant="outline"
        >
          <Link href={`/${orgSlug}/tasks/github/lightfast-repo` as Route}>
            <ExternalLink aria-hidden="true" className="size-3.5" />
            Open setup
          </Link>
        </Button>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm test "settings-source-control-lightfast-repository-card"`
Expected: PASS.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/lightfast-repository-card.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-lightfast-repository-card.test.tsx"
git commit -m "feat(source-control): add Lightfast repository card with verified/unverified states"
```

---

## Task 5: `RepositoryCard`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-card.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-repository-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `settings-source-control-repository-card.test.tsx`. It mocks the DropdownMenu primitive so the menu item link renders inline:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const { RepositoryCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-card"
);

const baseRepository = {
  fullName: "acme-live/web",
  id: "101",
  imported: true,
  name: "web",
  owner: { id: "987654", login: "acme-live" },
  private: true,
  syncStatus: "disabled" as const,
  watchedPathGlobs: null,
};

describe("RepositoryCard", () => {
  it("renders the repository name, visibility, sync status and GitHub link", () => {
    render(<RepositoryCard repository={baseRepository} />);

    expect(screen.getByText("acme-live/web")).toBeVisible();
    expect(screen.getByText("Private")).toBeVisible();
    expect(screen.getByText("Not syncing")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open on GitHub" })
    ).toHaveAttribute("href", "https://github.com/acme-live/web");
  });

  it("shows the syncing label for enabled repositories", () => {
    render(
      <RepositoryCard
        repository={{ ...baseRepository, syncStatus: "enabled" }}
      />
    );

    expect(screen.getByText("Syncing")).toBeVisible();
  });

  it("reveals the empty watched-paths message when expanded", () => {
    render(<RepositoryCard repository={baseRepository} />);

    expect(screen.queryByText("No watched paths configured")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Watched paths" }));
    expect(screen.getByText("No watched paths configured")).toBeVisible();
  });

  it("describes the all-paths glob in human terms", () => {
    render(
      <RepositoryCard
        repository={{ ...baseRepository, watchedPathGlobs: ["**"] }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Watched paths" }));
    expect(screen.getByText("Watching all paths")).toBeVisible();
  });

  it("lists each specific watched glob as a chip", () => {
    render(
      <RepositoryCard
        repository={{
          ...baseRepository,
          watchedPathGlobs: ["apps/**", "packages/**"],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Watched paths" }));
    expect(screen.getByText("apps/**")).toBeVisible();
    expect(screen.getByText("packages/**")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm test "settings-source-control-repository-card"`
Expected: FAIL — cannot resolve the `repository-card` module.

- [ ] **Step 3: Create the component**

Create `repository-card.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";

type SourceControlRepositoryRow =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"]["repositories"][number];

// Mirror of SOURCE_CONTROL_ALL_PATHS_GLOB from @repo/source-control-contract.
// Inlined to avoid adding a workspace dependency to the app for one literal.
const ALL_PATHS_GLOB = "**";

const SYNC_STATUS_LABEL: Record<
  SourceControlRepositoryRow["syncStatus"],
  string
> = {
  enabled: "Syncing",
  disabled: "Not syncing",
};

function SyncStatusIndicator({
  status,
}: {
  status: SourceControlRepositoryRow["syncStatus"];
}) {
  const enabled = status === "enabled";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 font-mono text-[10px]",
        enabled
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          enabled ? "bg-emerald-500" : "bg-muted-foreground/50"
        )}
      />
      {SYNC_STATUS_LABEL[status]}
    </span>
  );
}

function WatchedPaths({ globs }: { globs: string[] | null }) {
  if (globs === null) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No watched paths configured
      </p>
    );
  }

  if (globs.includes(ALL_PATHS_GLOB)) {
    return (
      <p className="text-[11px] text-muted-foreground">Watching all paths</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {globs.map((glob) => (
        <span
          className="inline-flex items-center rounded-[7px] border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground"
          key={glob}
        >
          {glob}
        </span>
      ))}
    </div>
  );
}

export function RepositoryCard({
  repository,
}: {
  repository: SourceControlRepositoryRow;
}) {
  const [expanded, setExpanded] = useState(false);
  const watchedRegionId = `repository-${repository.id}-watched`;

  return (
    <div className="rounded-[8px] border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-input bg-background">
            <GitBranch
              aria-hidden="true"
              className="size-3.5 text-foreground"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-mono text-foreground text-sm">
                {repository.fullName}
              </p>
              <Badge
                className="rounded-[7px] px-1.5 py-0 font-mono text-[10px]"
                variant="outline"
              >
                {repository.private ? "Private" : "Public"}
              </Badge>
              <SyncStatusIndicator status={repository.syncStatus} />
            </div>
            <button
              aria-controls={watchedRegionId}
              aria-expanded={expanded}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" className="size-3" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-3" />
              )}
              Watched paths
            </button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Repository actions for ${repository.fullName}`}
              className="size-7 rounded-[9px] p-0"
              size="sm"
              type="button"
              variant="ghost"
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={`https://github.com/${repository.fullName}`}
                rel="noreferrer"
                target="_blank"
              >
                Open on GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded ? (
        <div
          className="mt-3 rounded-[8px] border border-border bg-background/50 p-3"
          id={watchedRegionId}
        >
          <WatchedPaths globs={repository.watchedPathGlobs} />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm test "settings-source-control-repository-card"`
Expected: PASS.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-card.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-repository-card.test.tsx"
git commit -m "feat(source-control): add repository card with watched paths and sync status"
```

---

## Task 6: `AddRepositoryDialog`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/add-repository-dialog.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-add-repository-dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `settings-source-control-add-repository-dialog.test.tsx`. It reuses the `dialog` mock pattern from the (soon-removed) connection-section test and asserts the import flow + admin gating via the `disabled` prop:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importRepositoryMutateMock = vi.fn();
const importRepositoryMutationOptionsMock = vi.fn((options: unknown) => options);
const setQueryDataMock = vi.fn();
const listRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((options: unknown) => ({
    isPending: false,
    mutate: importRepositoryMutateMock,
    options,
  })),
  useQueryClient: () => ({
    setQueryData: setQueryDataMock,
  }),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        sourceControl: {
          importRepository: {
            mutationOptions: importRepositoryMutationOptionsMock,
          },
          listRepositories: {
            queryOptions: listRepositoriesQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@repo/ui/components/ui/dialog", async () => {
  const React = await import("react");
  const DialogContext = React.createContext<{
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
  } | null>(null);

  return {
    Dialog: ({
      children,
      onOpenChange,
      open,
    }: {
      children?: ReactNode;
      onOpenChange?: (open: boolean) => void;
      open?: boolean;
    }) => (
      <DialogContext.Provider value={{ onOpenChange, open }}>
        {children}
      </DialogContext.Provider>
    ),
    DialogContent: ({ children }: { children?: ReactNode }) => {
      const context = React.useContext(DialogContext);
      if (!context?.open) {
        return null;
      }
      return (
        <div role="dialog">
          {children}
          <button onClick={() => context.onOpenChange?.(false)} type="button">
            Close
          </button>
        </div>
      );
    },
    DialogDescription: ({ children }: { children?: ReactNode }) => (
      <p>{children}</p>
    ),
    DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h3>{children}</h3>,
    DialogTrigger: ({ children }: { children?: ReactNode }) => {
      const context = React.useContext(DialogContext);
      if (!React.isValidElement(children)) {
        return <>{children}</>;
      }
      const child = children as React.ReactElement<{
        onClick?: React.MouseEventHandler;
      }>;
      return React.cloneElement(child, {
        onClick: (event) => {
          child.props.onClick?.(event);
          context?.onOpenChange?.(true);
        },
      });
    },
  };
});

const { AddRepositoryDialog } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/add-repository-dialog"
);

const repositories = [
  {
    fullName: "acme-live/app",
    id: "101",
    imported: true,
    name: "app",
    owner: { id: "987654", login: "acme-live" },
    private: true,
    syncStatus: "disabled" as const,
    watchedPathGlobs: ["**"],
  },
  {
    fullName: "acme-live/docs",
    id: "201",
    imported: false,
    name: "docs",
    owner: { id: "987654", login: "acme-live" },
    private: false,
    syncStatus: "disabled" as const,
    watchedPathGlobs: null,
  },
];

function renderDialog(disabled = false) {
  return render(
    <AddRepositoryDialog disabled={disabled} repositories={repositories} />
  );
}

beforeEach(() => {
  importRepositoryMutateMock.mockClear();
  importRepositoryMutationOptionsMock.mockClear();
  setQueryDataMock.mockClear();
  listRepositoriesQueryOptionsMock.mockClear();
});

describe("AddRepositoryDialog", () => {
  it("disables the trigger when the parent says so", () => {
    renderDialog(true);
    expect(
      screen.getByRole("button", { name: "Add repository" })
    ).toBeDisabled();
  });

  it("opens the dialog and disables already-added rows", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /acme-live\/app/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /acme-live\/docs/i })
    ).not.toBeDisabled();
  });

  it("excludes the .lightfast repository from the picker", () => {
    render(
      <AddRepositoryDialog
        disabled={false}
        repositories={[
          ...repositories,
          {
            fullName: "acme-live/.lightfast",
            id: "301",
            imported: false,
            name: ".lightfast",
            owner: { id: "987654", login: "acme-live" },
            private: true,
            syncStatus: "disabled" as const,
            watchedPathGlobs: null,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    expect(
      screen.queryByRole("button", { name: /acme-live\/\.lightfast/i })
    ).toBeNull();
  });

  it("selects an available repository and submits the import mutation", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add selected repository" })
    );

    expect(importRepositoryMutateMock).toHaveBeenCalledWith({
      repositoryId: "201",
    });
  });

  it("drops a selection that is filtered out before submit", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search repositories" }),
      { target: { value: "app" } }
    );

    expect(
      screen.getByRole("button", { name: "Add selected repository" })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Add selected repository" })
    );
    expect(importRepositoryMutateMock).not.toHaveBeenCalled();
  });

  it("resets search and selection after the dialog closes", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search repositories" }),
      { target: { value: "docs" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /acme-live\/docs/i }));
    expect(
      screen.getByRole("button", { name: "Add selected repository" })
    ).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    expect(
      screen.getByRole("textbox", { name: "Search repositories" })
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Add selected repository" })
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm test "settings-source-control-add-repository-dialog"`
Expected: FAIL — cannot resolve the `add-repository-dialog` module.

- [ ] **Step 3: Create the component**

Create `add-repository-dialog.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/app-setup-contract";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";

type SourceControlRepositoryRow =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"]["repositories"][number];

export function AddRepositoryDialog({
  disabled,
  repositories,
}: {
  disabled: boolean;
  repositories: SourceControlRepositoryRow[];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryOptions =
    trpc.org.settings.sourceControl.listRepositories.queryOptions();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<
    string | null
  >(null);

  const importRepository = useMutation(
    trpc.org.settings.sourceControl.importRepository.mutationOptions({
      meta: { errorTitle: "Failed to add repository" },
      onSuccess: (data) => {
        queryClient.setQueryData(listQueryOptions.queryKey, data);
        setSelectedRepositoryId(null);
        setSearch("");
        setIsOpen(false);
      },
    })
  );

  const selectableRepositories = useMemo(
    () =>
      repositories.filter(
        (repository) => repository.name !== LIGHTFAST_REPOSITORY_NAME
      ),
    [repositories]
  );
  const filteredRepositories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return selectableRepositories.filter((repository) => {
      if (!term) {
        return true;
      }
      return (
        repository.name.toLowerCase().includes(term) ||
        repository.fullName.toLowerCase().includes(term)
      );
    });
  }, [selectableRepositories, search]);

  const selectedRepository = filteredRepositories.find(
    (repository) => repository.id === selectedRepositoryId
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearch("");
      setSelectedRepositoryId(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setSelectedRepositoryId(null);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-7 rounded-[9px]"
          disabled={disabled}
          size="sm"
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add repository
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add repository</DialogTitle>
          <DialogDescription>
            Select one GitHub repository to add to this workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            />
            <Input
              aria-label="Search repositories"
              className="pl-9"
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search repositories"
              value={search}
            />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filteredRepositories.length > 0 ? (
              filteredRepositories.map((repository) => (
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={repository.imported}
                  key={repository.id}
                  onClick={() => setSelectedRepositoryId(repository.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground text-sm">
                      {repository.fullName}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-muted-foreground text-xs">
                      <GitBranch aria-hidden="true" className="size-3" />
                      {repository.imported
                        ? "Already added"
                        : selectedRepositoryId === repository.id
                          ? "Selected"
                          : "Available"}
                    </span>
                  </span>
                  <Badge variant="outline">
                    {repository.private ? "Private" : "Public"}
                  </Badge>
                </button>
              ))
            ) : (
              <p className="rounded-[8px] border border-border bg-muted/30 p-4 text-muted-foreground text-sm">
                No repositories match your search.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={
              !selectedRepository ||
              selectedRepository.imported ||
              importRepository.isPending
            }
            onClick={() => {
              if (!selectedRepositoryId) {
                return;
              }
              importRepository.mutate({ repositoryId: selectedRepositoryId });
            }}
            type="button"
          >
            {importRepository.isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Add selected repository
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm test "settings-source-control-add-repository-dialog"`
Expected: PASS.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/add-repository-dialog.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-add-repository-dialog.test.tsx"
git commit -m "feat(source-control): extract add-repository dialog component"
```

---

## Task 7: `RepositoryList`

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-list.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-repository-list.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `settings-source-control-repository-list.test.tsx`. It stubs the two children (`repository-card`, `add-repository-dialog`) so the list logic is tested in isolation:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const listRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        sourceControl: {
          listRepositories: {
            queryOptions: listRepositoriesQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-card",
  () => ({
    RepositoryCard: ({
      repository,
    }: {
      repository: { fullName: string };
    }) => <div data-testid="repository-card">{repository.fullName}</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/add-repository-dialog",
  () => ({
    AddRepositoryDialog: ({ disabled }: { disabled: boolean }) => (
      <div data-disabled={String(disabled)} data-testid="add-repository-dialog">
        Add repository
      </div>
    ),
  })
);

const { RepositoryList } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-list"
);

const importedRepo = {
  fullName: "acme-live/app",
  id: "101",
  imported: true,
  name: "app",
  owner: { id: "987654", login: "acme-live" },
  private: true,
  syncStatus: "disabled" as const,
  watchedPathGlobs: ["**"],
};
const availableRepo = {
  fullName: "acme-live/docs",
  id: "201",
  imported: false,
  name: "docs",
  owner: { id: "987654", login: "acme-live" },
  private: false,
  syncStatus: "disabled" as const,
  watchedPathGlobs: null,
};

const baseRepositories = {
  binding: {
    accountLogin: "acme-live",
    connectedAt: new Date("2026-05-29T01:02:03.000Z"),
    importedRepositoryCount: 1,
    lightfastRepository: null,
    provider: "github" as const,
    providerLabel: "GitHub",
  },
  lightfastRepository: null,
  organization: {
    id: "987654",
    installationManageUrl:
      "https://github.com/apps/lightfast/installations/1001",
    login: "acme-live",
  },
  repositories: [importedRepo, availableRepo],
  repositoriesError: null,
  status: "bound" as const,
};

function renderList(
  overrides: Partial<typeof baseRepositories> = {}
) {
  return render(
    <RepositoryList repositories={{ ...baseRepositories, ...overrides }} />
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    has: ({ role }: { role: string }) => role === "org:admin",
    isLoaded: true,
  });
  invalidateQueriesMock.mockClear();
  listRepositoriesQueryOptionsMock.mockClear();
});

describe("RepositoryList", () => {
  it("renders the section header, refresh and add controls", () => {
    renderList();

    expect(screen.getByRole("heading", { name: "Repositories" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Refresh repositories" })
    ).toBeVisible();
    expect(screen.getByTestId("add-repository-dialog")).toBeVisible();
  });

  it("renders a card only for imported repositories", () => {
    renderList();

    const cards = screen.getAllByTestId("repository-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("acme-live/app");
  });

  it("shows the empty prompt when no repositories are imported", () => {
    renderList({ repositories: [availableRepo] });

    expect(screen.queryByTestId("repository-card")).toBeNull();
    expect(
      screen.getByText(/No repositories added yet\./)
    ).toBeVisible();
  });

  it("shows the listing error in place of the cards", () => {
    renderList({
      repositories: [],
      repositoriesError: {
        code: "github_repository_listing_failed",
        message: "GitHub repositories could not be refreshed.",
      },
    });

    expect(
      screen.getByText("GitHub repositories could not be refreshed.")
    ).toBeVisible();
    expect(screen.queryByTestId("repository-card")).toBeNull();
  });

  it("invalidates the repository query when refreshed", () => {
    renderList();

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh repositories" })
    );
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "sourceControl", "listRepositories"],
    });
  });

  it("disables adding for non-admins", () => {
    useAuthMock.mockReturnValue({ has: () => false, isLoaded: true });
    renderList();

    expect(screen.getByTestId("add-repository-dialog")).toHaveAttribute(
      "data-disabled",
      "true"
    );
  });

  it("disables adding when the repository listing failed", () => {
    renderList({
      repositories: [importedRepo],
      repositoriesError: {
        code: "github_repository_listing_failed",
        message: "GitHub repositories could not be refreshed.",
      },
    });

    expect(screen.getByTestId("add-repository-dialog")).toHaveAttribute(
      "data-disabled",
      "true"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/app && pnpm test "settings-source-control-repository-list"`
Expected: FAIL — cannot resolve the `repository-list` module.

- [ ] **Step 3: Create the component**

Create `repository-list.tsx`:

```tsx
"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useTRPC } from "~/trpc/react";
import { AddRepositoryDialog } from "./add-repository-dialog";
import { RepositoryCard } from "./repository-card";

type SourceControlRepositories =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"];

export function RepositoryList({
  repositories,
}: {
  repositories: SourceControlRepositories;
}) {
  const { has, isLoaded } = useAuth();
  const isAdmin = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryOptions =
    trpc.org.settings.sourceControl.listRepositories.queryOptions();

  const importedRepositories = useMemo(
    () => repositories.repositories.filter((repository) => repository.imported),
    [repositories.repositories]
  );

  const addDisabled =
    !isAdmin ||
    repositories.repositoriesError !== null ||
    repositories.status !== "bound";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-mono font-normal text-[11px] text-muted-foreground">
          Repositories
        </h3>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Refresh repositories"
            className="h-7 rounded-[9px]"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: listQueryOptions.queryKey,
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
          <AddRepositoryDialog
            disabled={addDisabled}
            repositories={repositories.repositories}
          />
        </div>
      </div>

      {repositories.repositoriesError ? (
        <div className="rounded-[8px] border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
          {repositories.repositoriesError.message}
        </div>
      ) : importedRepositories.length > 0 ? (
        <div className="space-y-3">
          {importedRepositories.map((repository) => (
            <RepositoryCard key={repository.id} repository={repository} />
          ))}
        </div>
      ) : (
        <p className="rounded-[8px] border border-border bg-background p-4 text-muted-foreground text-sm">
          No repositories added yet. Use{" "}
          <span className="font-medium text-foreground">Add repository</span> to
          connect one.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/app && pnpm test "settings-source-control-repository-list"`
Expected: PASS.

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-list.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-repository-list.test.tsx"
git commit -m "feat(source-control): add repository list section"
```

---

## Task 8: Rework the client + remove the old section file

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-settings-client.tsx`
- Modify (rework test): `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-client.test.tsx`
- Delete: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-connection-section.tsx`
- Delete: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx`

- [ ] **Step 1: Confirm the old section file has no other importers**

Run:
```bash
grep -rn "source-control-connection-section" "apps/app/src" || echo "no importers"
```
Expected: only the client (`source-control-settings-client.tsx`) and the connection-section test reference it. Both are handled in this task. If any other file imports it, stop and reassess.

- [ ] **Step 2: Rewrite the client test to cover the new structure**

Replace the entire contents of `settings-source-control-client.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sourceControlGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "get"],
}));
const sourceControlListRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        sourceControl: {
          get: { queryOptions: sourceControlGetQueryOptionsMock },
          listRepositories: {
            queryOptions: sourceControlListRepositoriesQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children?: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/organization-card",
  () => ({
    OrganizationCard: ({
      connection,
    }: {
      connection: { accountLogin: string };
    }) => (
      <div data-testid="organization-card">{connection.accountLogin}</div>
    ),
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/lightfast-repository-card",
  () => ({
    LightfastRepositoryCard: ({ orgSlug }: { orgSlug: string }) => (
      <div data-testid="lightfast-repository-card">{orgSlug}</div>
    ),
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/repository-list",
  () => ({
    RepositoryList: ({
      repositories,
    }: {
      repositories: { organization: { login: string } | null };
    }) => (
      <div data-testid="repository-list">
        {repositories.organization?.login ?? "no-org"}
      </div>
    ),
  })
);

const { SourceControlSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-settings-client"
);

const boundBinding = {
  accountLogin: "acme-live",
  connectedAt: new Date("2026-05-29T01:02:03.000Z"),
  importedRepositoryCount: 2,
  lightfastRepository: null,
  provider: "github" as const,
  providerLabel: "GitHub",
};

const boundRepositories = {
  binding: boundBinding,
  lightfastRepository: null,
  organization: {
    id: "987654",
    installationManageUrl:
      "https://github.com/apps/lightfast/installations/1001",
    login: "acme-live",
  },
  repositories: [],
  repositoriesError: null,
  status: "bound" as const,
};

function mockQueries(options: {
  binding: typeof boundBinding | null;
  repositories: typeof boundRepositories;
}) {
  useSuspenseQueryMock.mockImplementation(
    (queryOptions: { queryKey: readonly unknown[] }) => {
      if (queryOptions.queryKey.includes("listRepositories")) {
        return { data: options.repositories };
      }
      return { data: { binding: options.binding, status: "bound" } };
    }
  );
}

beforeEach(() => {
  sourceControlGetQueryOptionsMock.mockClear();
  sourceControlListRepositoriesQueryOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
});

describe("SourceControlSettingsClient", () => {
  it("renders the three sections when bound", () => {
    mockQueries({ binding: boundBinding, repositories: boundRepositories });
    render(<SourceControlSettingsClient slug="acme" />);

    expect(sourceControlGetQueryOptionsMock).toHaveBeenCalled();
    expect(sourceControlListRepositoriesQueryOptionsMock).toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Source Control & Git" })
    ).toBeVisible();
    expect(screen.getByTestId("organization-card")).toHaveTextContent(
      "acme-live"
    );
    expect(screen.getByTestId("lightfast-repository-card")).toHaveTextContent(
      "acme"
    );
    expect(screen.getByTestId("repository-list")).toHaveTextContent(
      "acme-live"
    );
  });

  it("renders only the empty state when unbound", () => {
    mockQueries({
      binding: null,
      repositories: {
        ...boundRepositories,
        binding: null as unknown as typeof boundBinding,
        organization: null,
        status: "unbound" as unknown as "bound",
      },
    });
    render(<SourceControlSettingsClient slug="acme" />);

    expect(
      screen.getByText("No GitHub organization connected")
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Open setup" })).toHaveAttribute(
      "href",
      "/acme/tasks/bind"
    );
    expect(screen.queryByTestId("organization-card")).toBeNull();
    expect(screen.queryByTestId("lightfast-repository-card")).toBeNull();
    expect(screen.queryByTestId("repository-list")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the reworked client test to verify it fails**

Run: `cd apps/app && pnpm test "settings-source-control-client"`
Expected: FAIL — the client still imports `./source-control-connection-section` (old `SourceControlSection`/`SourceControlConnectionSection`) and does not yet branch on `connection`, so the new child mocks/test-ids don't match.

- [ ] **Step 4: Rewrite the client component**

Replace the entire contents of `source-control-settings-client.tsx` with:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";
import { LightfastRepositoryCard } from "./lightfast-repository-card";
import { OrganizationCard } from "./organization-card";
import { RepositoryList } from "./repository-list";

interface SourceControlSettingsClientProps {
  slug: string;
}

export function SourceControlSettingsClient({
  slug,
}: SourceControlSettingsClientProps) {
  const trpc = useTRPC();

  const { data: sourceControlConnection } = useSuspenseQuery(
    trpc.org.settings.sourceControl.get.queryOptions()
  );
  const { data: sourceControlRepositories } = useSuspenseQuery(
    trpc.org.settings.sourceControl.listRepositories.queryOptions()
  );

  const connection = sourceControlConnection.binding;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Source Control &amp; Git
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your GitHub connection and the repositories Lightfast can
          access.
        </p>
      </div>

      {connection ? (
        <>
          <OrganizationCard connection={connection} />
          <LightfastRepositoryCard connection={connection} orgSlug={slug} />
          <RepositoryList repositories={sourceControlRepositories} />
        </>
      ) : (
        <div className="rounded-[8px] border border-border bg-background p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">
                No GitHub organization connected
              </p>
              <p className="text-muted-foreground text-sm">
                Connect GitHub from setup before workspace features can use
                source-control data.
              </p>
            </div>
            <Button
              asChild
              className="h-7 rounded-[9px]"
              size="sm"
              variant="secondary"
            >
              <Link href={`/${slug}/tasks/bind` as Route}>
                <ExternalLink aria-hidden="true" className="size-4" />
                Open setup
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the reworked client test to verify it passes**

Run: `cd apps/app && pnpm test "settings-source-control-client"`
Expected: PASS (both bound + unbound cases).

- [ ] **Step 6: Delete the old section file and its test**

```bash
git rm "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-connection-section.tsx"
git rm "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-connection-section.test.tsx"
```

(If not committing yet, use `rm` instead of `git rm` and let the user stage the deletions.)

- [ ] **Step 7: Confirm nothing references the deleted module**

Run:
```bash
grep -rn "source-control-connection-section\|SourceControlConnectionSection\|SourceControlSection" "apps/app/src" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 8: Commit (checkpoint)**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-settings-client.tsx" "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-source-control-client.test.tsx"
git commit -m "feat(source-control): compose redesigned settings sections and drop legacy file"
```

---

## Task 9: Full verification

**Files:** none (validation only)

- [ ] **Step 1: Run the full source-control + settings test surface**

Run: `cd apps/app && pnpm test "settings-source-control"`
Expected: PASS for `format`, `organization-card`, `lightfast-repository-card`, `repository-card`, `add-repository-dialog`, `repository-list`, `client`, and `page` (unchanged page test still passes).

- [ ] **Step 2: Run the API service test**

Run: `cd api/app && pnpm test "repositories"`
Expected: PASS.

- [ ] **Step 3: Typecheck the app**

Run: `cd apps/app && pnpm with-env next typegen` then `pnpm typecheck`
Expected: no type errors. The `listRepositories` output type now includes `syncStatus`; `RepositoryCard`/`AddRepositoryDialog`/`RepositoryList` consume it.

- [ ] **Step 4: Lint/format the changed files**

Run: `pnpm check`
Expected: clean (or auto-fixable formatting only). Address any reported issues.

- [ ] **Step 5: Manual smoke (optional but recommended)**

With `pnpm dev` running, open `https://[<wt>.]lightfast.localhost/<slug>/settings/source-control` for a bound org and verify: Organization card with disabled "Connected ⌄" menu + tooltip; Lightfast repository card (Verified or Open setup); Repositories section listing only imported repos, each expandable to Watched paths, with sync status and a working "Open on GitHub". Then verify an unbound org shows only the empty state.

- [ ] **Step 6: Final commit (checkpoint, if anything changed during verification)**

```bash
git add <exact paths touched by check/format>
git commit -m "chore(source-control): formatting and verification fixups"
```

---

## Self-review notes

- **Spec coverage:** Three sections (Tasks 3/4/7) ✓; bg-background tokens ✓; bound vs unbound composition (Task 8 client) ✓; Organization disabled dropdown + tooltip (Task 3) ✓; "Connected on {date}" default (Task 2 + 3) ✓; Lightfast verified/unverified (Task 4) ✓; imported-only list (Task 7) ✓; Refresh + Add header (Task 7) ✓; repo card watched paths/sync status/Open-on-GitHub (Task 5) ✓; error + no-imported states (Task 7) ✓; single backend `syncStatus` change (Task 1) ✓; component split + delete legacy (Tasks 2–8) ✓; testing plan (every component + reworked client + API) ✓.
- **Open item (from spec):** Org card subtitle uses **"Connected on {date}"** (binding exposes only `connectedByUserId`, no display name). No "Enabled by {name}" Clerk lookup in this plan.
- **Type consistency:** `SourceControlRepositoryRow` (API) gains `syncStatus: SourceControlRepository["syncStatus"]`; the frontend derives the same shape via `AppRouterOutputs[...]["listRepositories"]["repositories"][number]`, so `syncStatus`/`watchedPathGlobs`/`imported`/`private` line up across Tasks 1, 5, 6, 7. `SourceControlConnection = NonNullable<...["get"]["binding"]>` is used identically in Tasks 3 and 4.
- **No placeholders:** every code/test step contains full content; commands include expected outcomes.
