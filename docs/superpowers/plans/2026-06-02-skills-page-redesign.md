# Skills Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the verbose Skills row-list + standalone detail page with a centered hero, a search + validity filter, a single "Team" grid of compact skill cells, and a centered dialog (deep-linked via `?skill=<slug>`) for reading a skill.

**Architecture:** Pure UI/structural change in `apps/app`. The page keeps its existing `prefetch` → `HydrateClient` → client shape and the existing `skills.list` tRPC payload (every skill already carries `bodyMarkdown`, `diagnostics`, `resources`, `path`, `indexedCommitSha`), so the dialog reads from data already in the client — no new fetch, no router/schema changes. Detail moves from a route to a `?skill` query-param dialog (nuqs `useQueryState`, mirroring the connectors sheet). The old `[skillSlug]` route, `skill-row.tsx`, and `skill-detail.tsx` are deleted.

**Tech Stack:** Next.js (App Router), React, TypeScript, tRPC + TanStack Query, nuqs, Radix UI (`@repo/ui` Dialog/Select/Input/Button), Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-01-skills-page-redesign-design.md`

**Conventions for every commit step:**
- Stage with explicit pathspecs only (a concurrent agent may have other files staged — never `git add -A` / `git add .`).
- End every commit message body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

```
apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/
  page.tsx                          UNCHANGED  (prefetch + HydrateClient + Suspense + SkillsClient)
  _components/
    skills-client.tsx               REWRITE    hero + controls + freshness/repo link + diagnostics banner + grid + dialog wiring + query-state
    skill-grid.tsx                  NEW        "Team" header + visible count + 2-col grid + empty state
    skill-cell.tsx                  NEW        one compact clickable cell (glyph/name/desc + Invalid pill)
    skill-glyph.tsx                 NEW        shared skill glyph (size via className)
    skill-dialog.tsx                NEW        centered dialog: header, description, diagnostics, markdown, footer
    skill-markdown.tsx              KEEP       renders SKILL.md (SkillMarkdown + getSkillSourceUrl)
    skill-status.tsx                KEEP       freshness badge (now placed in the controls row)
    skills-loading.tsx              UPDATE     skeleton matching hero + controls + grid
    skill-row.tsx                   DELETE     replaced by skill-cell
    skill-detail.tsx                DELETE     replaced by skill-dialog
  [skillSlug]/page.tsx              DELETE     detail is now a dialog

apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/
  fixtures.ts                       NEW        createSkill() + createListData() shared test factories
  skill-cell.test.tsx               NEW
  skill-grid.test.tsx               NEW
  skill-dialog.test.tsx             NEW
  skills-client.test.tsx            REWRITE    grid render, search, invalid pill, cell-click sets ?skill, dialog open
  page.test.tsx                     UNCHANGED  (mocks SkillsClient; still asserts prefetch-before-hydrate)
  skill-markdown.test.tsx           UNCHANGED
```

Notes:
- `skill-glyph.tsx` has no dedicated test — it is pure SVG markup, mirroring `connectors/_components/connector-icons.tsx` (also untested). It is exercised through `skill-cell.test.tsx`.
- `skills-loading.tsx` has no dedicated test — `page.test.tsx` mocks it; consistent with the current repo (no skills-loading test exists).
- Radix Select's open/keyboard interaction is not unit-tested (portal/pointer behavior is brittle in jsdom and untested elsewhere in this app). Filter wiring is trivial; the Invalid-pill path is covered via the cell.

---

## Task 1: Shared test fixtures

**Files:**
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/fixtures.ts`

- [ ] **Step 1: Create the fixtures module**

These factories return fully-typed objects matching the `skills.list` payload, so every later test stays DRY and type-safe. (Mirrors the inline factory that currently lives in `skills-client.test.tsx`, now extracted.)

```ts
import type { AppRouterOutputs } from "@api/app";

type SkillsListResult = AppRouterOutputs["org"]["workspace"]["skills"]["list"];
export type Skill = SkillsListResult["skills"][number];

export function createSkill(overrides: Partial<Skill> = {}): Skill {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    allowedTools: null,
    bodyMarkdown: "Body",
    compatibility: null,
    contentSha: "content-sha",
    contentSize: 100,
    createdAt: now,
    description: "Review code changes",
    diagnostics: [],
    id: 1,
    indexedCommitSha: "a".repeat(40),
    license: null,
    metadata: {},
    name: "code-review",
    nonStandardResourceCount: 0,
    path: "skills/code-review/SKILL.md",
    resources: { assets: [], references: [], scripts: [], truncated: false },
    resourcesTruncated: 0,
    skillIndexStateId: 1,
    slug: "code-review",
    sourceMarkdown: "---\nname: code-review\n---\nBody",
    updatedAt: now,
    validationStatus: "valid",
    ...overrides,
  };
}

export function createListData(
  input: {
    indexDiagnostics?: SkillsListResult["indexDiagnostics"];
    repositoryUrl?: string;
    skills?: Skill[];
  } = {}
): SkillsListResult {
  return {
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "a".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "a".repeat(40),
      status: "fresh",
    },
    indexDiagnostics: input.indexDiagnostics ?? [],
    repositoryUrl: input.repositoryUrl ?? "https://github.com/acme/.lightfast",
    skills: input.skills ?? [createSkill()],
  };
}
```

- [ ] **Step 2: Verify it type-checks (no test runner — it's a helper)**

Run: `cd apps/app && pnpm with-env tsc --noEmit -p tsconfig.json 2>&1 | grep -i "skills/fixtures" || echo "no fixtures type errors"`
Expected: `no fixtures type errors`

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/fixtures.ts"
git commit -m "test(skills): add shared skill fixtures for redesign tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: SkillGlyph (shared glyph)

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-glyph.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { cn } from "@repo/ui/lib/utils";

export function SkillGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground",
        className
      )}
    >
      <svg
        aria-hidden="true"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" opacity={0.5} />
        <path d="M12 12v9" opacity={0.5} />
      </svg>
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-glyph.tsx"
git commit -m "feat(skills): add shared skill glyph

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: SkillCell

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-cell.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-cell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSkill } from "./fixtures";

const { SkillCell } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-cell"
);

describe("SkillCell", () => {
  it("renders the name and description and selects on click", () => {
    const onSelect = vi.fn();
    render(
      <SkillCell
        onSelect={onSelect}
        skill={createSkill({ name: "Code Review", slug: "code-review" })}
      />
    );

    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("Review code changes")).toBeInTheDocument();
    expect(screen.queryByText("Invalid")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Code Review/i }));
    expect(onSelect).toHaveBeenCalledWith("code-review");
  });

  it("marks invalid skills", () => {
    render(
      <SkillCell
        onSelect={vi.fn()}
        skill={createSkill({ validationStatus: "invalid" })}
      />
    );

    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-cell.test.tsx"`
Expected: FAIL — cannot resolve `skill-cell` module.

- [ ] **Step 3: Create the shared `Skill` type module**

`skill-cell`, `skill-grid`, `skill-dialog`, and `skills-client` all need the same `Skill` row type. Define it once to keep them in sync.

File: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-types.ts`

```ts
import type { AppRouterOutputs } from "@api/app";

export type SkillsListResult =
  AppRouterOutputs["org"]["workspace"]["skills"]["list"];
export type Skill = SkillsListResult["skills"][number];
```

- [ ] **Step 4: Write the implementation**

```tsx
"use client";

import { SkillGlyph } from "./skill-glyph";
import type { Skill } from "./skills-types";

export function SkillCell({
  onSelect,
  skill,
}: {
  onSelect: (slug: string) => void;
  skill: Skill;
}) {
  const isInvalid = skill.validationStatus === "invalid";

  return (
    <button
      className="flex w-full items-center gap-3 rounded-[9px] px-2.5 py-3 text-left hover:bg-muted/50"
      onClick={() => onSelect(skill.slug)}
      type="button"
    >
      <SkillGlyph />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground text-sm">
          {skill.name ?? skill.slug}
        </span>
        {skill.description && (
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            {skill.description}
          </span>
        )}
      </span>
      {isInvalid && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/35 px-2 py-0.5 text-amber-500 text-xs">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Invalid
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-cell.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-cell.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-types.ts" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-cell.test.tsx"
git commit -m "feat(skills): add SkillCell grid item

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SkillGrid

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-grid.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-grid.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSkill } from "./fixtures";

const { SkillGrid } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-grid"
);

describe("SkillGrid", () => {
  it("renders the Team header with the visible count and one cell per skill", () => {
    render(
      <SkillGrid
        emptyState="No matching skills."
        onSelect={vi.fn()}
        skills={[
          createSkill({ name: "Alpha", slug: "alpha" }),
          createSkill({ name: "Bravo", slug: "bravo" }),
        ]}
      />
    );

    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("forwards the selected slug", () => {
    const onSelect = vi.fn();
    render(
      <SkillGrid
        emptyState="No matching skills."
        onSelect={onSelect}
        skills={[createSkill({ name: "Alpha", slug: "alpha" })]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Alpha/i }));
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("renders the empty state when there are no skills", () => {
    render(
      <SkillGrid emptyState="No skills indexed." onSelect={vi.fn()} skills={[]} />
    );

    expect(screen.getByText("No skills indexed.")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-grid.test.tsx"`
Expected: FAIL — cannot resolve `skill-grid` module.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";

import type { ReactNode } from "react";
import { SkillCell } from "./skill-cell";
import type { Skill } from "./skills-types";

export function SkillGrid({
  emptyState,
  onSelect,
  skills,
}: {
  emptyState: ReactNode;
  onSelect: (slug: string) => void;
  skills: Skill[];
}) {
  return (
    <section className="mt-9">
      <div className="flex items-center gap-2 border-border border-b pb-2.5">
        <span className="font-medium text-foreground text-sm">Team</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
          {skills.length}
        </span>
      </div>
      {skills.length === 0 ? (
        <div className="py-10 text-muted-foreground text-sm">{emptyState}</div>
      ) : (
        <div className="mt-1 grid grid-cols-1 gap-x-2 sm:grid-cols-2">
          {skills.map((skill) => (
            <SkillCell key={skill.slug} onSelect={onSelect} skill={skill} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-grid.test.tsx"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-grid.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-grid.test.tsx"
git commit -m "feat(skills): add SkillGrid with Team group

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: SkillDialog

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-dialog.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-dialog.test.tsx`

Note: the dialog uses the Dialog's built-in top-right close (`showCloseButton`). It carries a single `View source` link in the footer — the approved mockup also drew a header source icon, but two identical source links is redundant, so this consolidates to one labeled link (the only deviation from the mockup; flag to the user during review if undesired).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSkill } from "./fixtures";

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-markdown",
  () => ({
    SkillMarkdown: () => <div>Markdown preview</div>,
    getSkillSourceUrl: () =>
      "https://github.com/acme/.lightfast/blob/main/skills/code-review/SKILL.md",
  })
);

const { SkillDialog } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-dialog"
);

describe("SkillDialog", () => {
  it("renders the skill content with a source link", () => {
    render(
      <SkillDialog
        onOpenChange={vi.fn()}
        repositoryUrl="https://github.com/acme/.lightfast"
        skill={createSkill({ name: "Code Review" })}
      />
    );

    expect(
      screen.getByRole("heading", { name: /Code Review/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Skill")).toBeInTheDocument();
    expect(screen.getByText("Review code changes")).toBeInTheDocument();
    expect(screen.getByText("Markdown preview")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View source/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/.lightfast/blob/main/skills/code-review/SKILL.md"
    );
  });

  it("surfaces diagnostics for invalid skills", () => {
    render(
      <SkillDialog
        onOpenChange={vi.fn()}
        repositoryUrl="https://github.com/acme/.lightfast"
        skill={createSkill({
          diagnostics: [
            {
              code: "frontmatter_missing",
              message: "Skill file must begin with YAML frontmatter.",
              severity: "error",
            },
          ],
          validationStatus: "invalid",
        })}
      />
    );

    expect(screen.getByText("1 diagnostic")).toBeInTheDocument();
    expect(
      screen.getByText("Skill file must begin with YAML frontmatter.")
    ).toBeInTheDocument();
  });

  it("renders nothing when no skill is selected", () => {
    render(
      <SkillDialog
        onOpenChange={vi.fn()}
        repositoryUrl="https://github.com/acme/.lightfast"
        skill={undefined}
      />
    );

    expect(screen.queryByText("Skill")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-dialog.test.tsx"`
Expected: FAIL — cannot resolve `skill-dialog` module.

- [ ] **Step 3: Write the implementation**

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { SkillGlyph } from "./skill-glyph";
import { getSkillSourceUrl, SkillMarkdown } from "./skill-markdown";
import type { Skill } from "./skills-types";

export function SkillDialog({
  onOpenChange,
  repositoryUrl,
  skill,
}: {
  onOpenChange: (open: boolean) => void;
  repositoryUrl: string;
  skill?: Skill;
}) {
  const sourceUrl = skill ? getSkillSourceUrl({ repositoryUrl, skill }) : "";

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(skill)}>
      <DialogContent className="flex max-h-[82vh] flex-col gap-0 sm:max-w-2xl">
        {skill && (
          <>
            <DialogHeader className="flex-row items-start gap-3 space-y-0 text-left">
              <SkillGlyph className="size-10 rounded-full" />
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <span className="truncate">{skill.name ?? skill.slug}</span>
                  <span className="font-normal text-base text-muted-foreground">
                    Skill
                  </span>
                </DialogTitle>
                {skill.description && (
                  <DialogDescription className="mt-2">
                    {skill.description}
                  </DialogDescription>
                )}
              </div>
            </DialogHeader>

            {skill.diagnostics.length > 0 && (
              <div className="mt-4 rounded-[9px] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-500/90 text-xs">
                <span className="font-medium text-amber-500">
                  {skill.diagnostics.length}{" "}
                  {skill.diagnostics.length === 1 ? "diagnostic" : "diagnostics"}
                </span>
                <ul className="mt-1 space-y-1">
                  {skill.diagnostics.map((diagnostic) => (
                    <li key={`${diagnostic.code}:${diagnostic.message}`}>
                      {diagnostic.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[12px] border border-border bg-muted/20 p-4">
              <SkillMarkdown repositoryUrl={repositoryUrl} skill={skill} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-border border-t pt-4">
              <span className="truncate font-mono text-muted-foreground text-xs">
                {skill.path}
              </span>
              {sourceUrl && (
                <Button asChild size="lf" variant="outline">
                  <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
                    <ExternalLink className="size-3.5" />
                    View source
                  </a>
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-dialog.test.tsx"`
Expected: PASS (3 tests). (The third asserts the closed dialog renders no content — Radix keeps it unmounted while `open` is false. The connectors sheet test establishes that Radix dialog components render in jsdom.)

- [ ] **Step 5: Commit**

```bash
git add \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-dialog.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skill-dialog.test.tsx"
git commit -m "feat(skills): add centered SkillDialog detail view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Rewrite SkillsClient

**Files:**
- Modify (rewrite): `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx`
- Modify (rewrite): `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx`

- [ ] **Step 1: Rewrite the test (it will fail against the old client)**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListData, createSkill } from "./fixtures";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "skills", "list"],
}));

let listData = createListData();

let skillParam: string | null = null;
const setSkillParamMock = vi.fn((next: string | null) => {
  skillParam = next;
});

vi.mock("nuqs", () => ({
  useQueryState: () => [skillParam, setSkillParamMock] as const,
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        skills: { list: { queryOptions: listQueryOptionsMock } },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: listData }),
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-markdown",
  () => ({
    SkillMarkdown: () => <div>Markdown preview</div>,
    getSkillSourceUrl: () =>
      "https://github.com/acme/.lightfast/blob/main/skills/code-review/SKILL.md",
  })
);

const { SkillsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client"
);

beforeEach(() => {
  listData = createListData();
  skillParam = null;
  setSkillParamMock.mockClear();
  listQueryOptionsMock.mockClear();
});

describe("SkillsClient", () => {
  it("renders the hero and a Team grid cell per skill", () => {
    render(<SkillsClient />);

    expect(
      screen.getByRole("heading", { name: "Make Lightfast work your way" })
    ).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("code-review")).toBeInTheDocument();
  });

  it("filters to a no-match empty state when the search misses", () => {
    render(<SkillsClient />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search skills" }), {
      target: { value: "does-not-match" },
    });

    expect(screen.getByText("No matching skills.")).toBeInTheDocument();
    expect(screen.queryByText("No skills indexed.")).not.toBeInTheDocument();
  });

  it("shows the indexed empty state only when the index has no skills", () => {
    listData = createListData({ skills: [] });

    render(<SkillsClient />);

    expect(screen.getByText("No skills indexed.")).toBeInTheDocument();
  });

  it("marks invalid skills in the grid", () => {
    listData = createListData({
      skills: [createSkill({ slug: "broken", validationStatus: "invalid" })],
    });

    render(<SkillsClient />);

    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });

  it("opens the dialog by setting the skill query param", () => {
    render(<SkillsClient />);

    fireEvent.click(screen.getByRole("button", { name: /code-review/i }));

    expect(setSkillParamMock).toHaveBeenCalledWith("code-review");
  });

  it("renders the dialog for the skill named in the query param", () => {
    skillParam = "code-review";

    render(<SkillsClient />);

    expect(
      screen.getByRole("heading", { name: /code-review/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Markdown preview")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx"`
Expected: FAIL — old client has no "Make Lightfast work your way" heading / no nuqs usage.

- [ ] **Step 3: Rewrite the client**

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { useDeferredValue, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { SkillDialog } from "./skill-dialog";
import { SkillGrid } from "./skill-grid";
import { SkillStatus } from "./skill-status";
import type { Skill } from "./skills-types";

type SkillFilter = "all" | "invalid" | "valid";

export function SkillsClient() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SkillFilter>("all");
  const [skillParam, setSkillParam] = useQueryState("skill");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visibleSkills = useMemo(
    () =>
      data.skills
        .filter((skill) => matchesFilter(skill, filter))
        .filter((skill) => matchesQuery(skill, deferredQuery))
        .sort((a, b) => {
          if (a.validationStatus !== b.validationStatus) {
            return a.validationStatus === "invalid" ? -1 : 1;
          }
          return a.slug.localeCompare(b.slug);
        }),
    [data.skills, deferredQuery, filter]
  );

  const selectedSkill = skillParam
    ? data.skills.find((skill) => skill.slug === skillParam)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="pt-6 text-center">
        <h1 className="font-semibold text-3xl text-foreground tracking-[-0.02em]">
          Make Lightfast work your way
        </h1>
        <p className="mx-auto mt-3 max-w-[30rem] text-muted-foreground text-sm">
          Reusable instructions your agents load on demand, indexed from your
          team&apos;s connected GitHub repository.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search skills"
            className="pl-8"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search skills"
            size="lf"
            value={query}
            variant="lf"
          />
        </div>
        <Select
          onValueChange={(value) => setFilter(value as SkillFilter)}
          value={filter}
        >
          <SelectTrigger
            aria-label="Filter skills"
            className="h-7 shrink-0 rounded-[9px] sm:w-32"
            size="sm"
          >
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <SkillStatus freshness={data.freshness} />
        {data.repositoryUrl && (
          <Button asChild size="lf" variant="ghost">
            <a
              href={data.repositoryUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open repository
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>

      {data.indexDiagnostics.length > 0 && (
        <div className="mt-4 rounded-[9px] border border-border bg-muted/20 px-3 py-2">
          <p className="font-medium text-foreground text-sm">
            Index diagnostics
          </p>
          <ul className="mt-1 space-y-1">
            {data.indexDiagnostics.map((diagnostic) => (
              <li
                className="text-muted-foreground text-xs"
                key={`${diagnostic.code}:${diagnostic.message}`}
              >
                {diagnostic.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <SkillGrid
        emptyState={
          data.skills.length === 0
            ? "No skills indexed."
            : "No matching skills."
        }
        onSelect={(slug) => {
          void setSkillParam(slug);
        }}
        skills={visibleSkills}
      />

      <SkillDialog
        onOpenChange={(open) => {
          if (!open) {
            void setSkillParam(null);
          }
        }}
        repositoryUrl={data.repositoryUrl}
        skill={selectedSkill}
      />
    </div>
  );
}

function matchesFilter(skill: Skill, filter: SkillFilter): boolean {
  return filter === "all" || skill.validationStatus === filter;
}

function matchesQuery(skill: Skill, query: string): boolean {
  if (!query) {
    return true;
  }

  return [skill.slug, skill.name ?? "", skill.description ?? "", skill.path]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx"
git commit -m "feat(skills): rewrite SkillsClient as hero + grid + dialog

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Update the loading skeleton

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-loading.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { Skeleton } from "@repo/ui/components/ui/skeleton";

export function SkillsLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="flex flex-col items-center pt-6">
        <Skeleton className="h-8 w-80 max-w-full rounded-md" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full rounded-md" />
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Skeleton className="h-7 flex-1 rounded-[9px]" />
        <Skeleton className="h-7 w-32 rounded-[9px]" />
      </div>

      <div className="mt-9 border-border border-b pb-2.5">
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>

      <div className="mt-1 grid grid-cols-1 gap-x-2 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="flex items-center gap-3 px-2.5 py-3" key={index}>
            <Skeleton className="size-9 rounded-[9px]" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="mt-2 h-3 w-40 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app test suite still imports/builds the loader (page.test mocks it)**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/page.test.tsx"`
Expected: PASS (1 test) — unchanged, still asserts prefetch-before-hydrate and the mocked heading.

- [ ] **Step 3: Commit**

```bash
git add "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-loading.tsx"
git commit -m "feat(skills): match loading skeleton to redesigned page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Delete the obsolete detail route + components

**Files:**
- Delete: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/[skillSlug]/page.tsx`
- Delete: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-row.tsx`
- Delete: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-detail.tsx`

- [ ] **Step 1: Confirm nothing else references the deleted files or the detail route**

Run:
```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
grep -rn "skill-row\|skill-detail\|skills/\[skillSlug\]\|skills/\${" apps/app/src --include="*.ts" --include="*.tsx" | grep -v "/skills/\[skillSlug\]/page.tsx"
grep -rn "/skills/" apps/app/src --include="*.tsx" | grep -i "slug.*skill\|skillSlug"
```
Expected: no remaining references to `skill-row`, `skill-detail`, or a `/skills/<slug>` link (the only link to the detail route lived inside the now-deleted `skill-row.tsx`). If any reference remains, replace it with a `?skill=<slug>` interaction before deleting.

- [ ] **Step 2: Delete the files**

```bash
cd /Users/jeevanpillay/Code/@lightfastai/lightfast
git rm \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/[skillSlug]/page.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-row.tsx" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-detail.tsx"
```

- [ ] **Step 3: Verify the skills test suite still passes**

Run: `cd apps/app && pnpm with-env vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills"`
Expected: PASS — page.test, skill-markdown.test, fixtures-backed cell/grid/dialog/client tests all green.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(skills): remove standalone detail route and row list

Detail now lives in the ?skill dialog.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the app and api**

Run: `pnpm --filter @api/app build && cd apps/app && pnpm with-env next typegen && pnpm with-env tsc --noEmit -p tsconfig.json`
Expected: no type errors. (`@api/app` build first so tRPC output types are current; `next typegen` refreshes route types after deleting `[skillSlug]`.)

- [ ] **Step 2: Lint / format check**

Run: `pnpm check`
Expected: passes (Biome/lint clean). If the formatter rewrites any new file, re-stage and amend the relevant commit.

- [ ] **Step 3: Run the full app test suite**

Run: `cd apps/app && pnpm with-env vitest run`
Expected: PASS, including all `skills` tests.

- [ ] **Step 4: Build the app**

Run: `pnpm build:app`
Expected: build succeeds with no route/type errors from the removed `[skillSlug]` page.

- [ ] **Step 5: Manual smoke (optional but recommended)**

With `pnpm dev` running, open `https://<wt>.app.lightfast.localhost/<org-slug>/skills`:
- Hero centered, search + `All` filter + freshness + `Open repository` link visible.
- "Team" group with a count; 2-column grid of cells; invalid skills show the amber `Invalid` pill.
- Click a cell → centered dialog with markdown + `View source`; URL gains `?skill=<slug>`.
- Close (X / Esc / overlay) → `?skill` clears.
- Filter to `Invalid` → only invalid skills; search narrows the count.

---

## Self-Review

**Spec coverage:**
- Centered hero + subtitle → Task 6 (client).
- Search + validity filter (All/Valid/Invalid) → Task 6.
- Freshness badge relocated to controls row → Task 6 (`SkillStatus`).
- `Open repository ↗` ghost link in controls row → Task 6 (decision: keep small link).
- Single "Team" group + **visible** count → Task 4 (`SkillGrid`, `skills.length`).
- 2-column compact grid of cells, no `+`/`✓` trailing action → Tasks 3–4.
- Invalid skills marked on the cell → Task 3.
- Centered dialog, visual-only (no toggle/uninstall/try-in-chat), markdown + diagnostics + View source → Task 5.
- Deep-link via `?skill=<slug>` → Task 6 (nuqs).
- Remove `[skillSlug]` route, `skill-row`, `skill-detail` → Task 8.
- Index-diagnostics banner preserved → Task 6.
- Empty vs no-match messaging preserved → Tasks 4 + 6.
- Router/services/`skills.get` untouched → no task touches them (confirmed).
- Loading skeleton updated → Task 7.

**Placeholder scan:** none — every step has full code or an exact command + expected output.

**Type consistency:** the shared `Skill` type lives in `skills-types.ts` (Task 3, Step 4) and is imported by `skill-cell`, `skill-grid`, `skill-dialog`, and `skills-client`. `SkillDialog` prop is `skill?: Skill`; `SkillGrid`/`SkillCell` use non-optional `skill: Skill`. `onSelect: (slug: string) => void` and `onOpenChange: (open: boolean) => void` signatures match across producer/consumer. Fixtures return `Skill` / `SkillsListResult`, matching `useSuspenseQuery` data and component props. `getSkillSourceUrl` / `SkillMarkdown` signatures are unchanged from the kept `skill-markdown.tsx`.
