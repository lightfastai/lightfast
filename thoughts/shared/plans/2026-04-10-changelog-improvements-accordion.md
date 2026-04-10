# Changelog Improvements Accordion — Implementation Plan

## Overview

Replace the plain markdown `## Improvements` bullet list in changelog MDX files with a structured frontmatter field rendered as a collapsible Radix accordion at the bottom of each changelog entry page. Modeled after the existing `FaqAccordion` pattern.

## Current State Analysis

- Improvements are inline markdown bullets under an `## Improvements` h2 in the MDX body (`apps/www/src/content/changelog/2026-03-26-initial.mdx:96-103`)
- `ChangelogEntrySchema` (`apps/www/src/lib/content-schemas.ts:50-58`) has no structured field for improvements
- The detail page renders everything via `<MDXContent>` — no separation between body content and improvements
- Existing `FaqAccordion` (`apps/www/src/app/(app)/_components/faq-accordion.tsx`) is the exact data-driven pattern to follow
- Radix accordion primitives (`packages/ui/src/components/ui/accordion.tsx`) provide chevron rotation + open/close animations out of the box

### Key Discoveries:

- `FaqAccordion` is `"use client"`, takes a flat array prop, uses `type="single"` with `collapsible` — exactly the behavior we need
- `FAQSection` (`faq-section.tsx:8`) lazy-loads the accordion via `next/dynamic` since it's below the fold — we should do the same
- Adding a field to `ChangelogEntrySchema` automatically makes it available on `page.data` with no loader or collection config changes needed (`source.config.ts:29-33` binds directly to the schema)
- The `faq` field on `ContentPageSchema` (`content-schemas.ts:29`) proves the pattern of structured arrays in frontmatter Zod schemas

## Desired End State

Each changelog detail page renders a collapsible "Improvements" accordion section at the bottom, below the MDX body and above the prev/next navigation. The improvements data lives in frontmatter YAML as a string array, validated by Zod at build time. The `## Improvements` markdown section is removed from the MDX body.

### Verification:

- `pnpm build:www` succeeds (Zod validates frontmatter, Next.js static generation works)
- `pnpm check && pnpm typecheck` pass
- Visiting `/changelog/2026-03-26-initial` shows:
  - No more `## Improvements` heading rendered inline in the MDX body
  - A collapsible "Improvements" accordion at the bottom of the page
  - Clicking the accordion opens/closes it with chevron rotation and animation
  - All 5 improvement items display as a bullet list inside the accordion

## What We're NOT Doing

- No item count badges
- No multiple themed sub-sections (e.g., "Editor", "Bug Fixes") — everything goes under a single "Improvements" section
- No changes to the changelog listing page (`changelog/page.tsx`) — improvements only appear on the detail page
- No changes to JSON-LD / structured data builders
- No changes to the base Radix accordion primitives in `@repo/ui`

## Implementation Approach

Follow the `FaqAccordion` → `FAQSection` pattern exactly: a `"use client"` data-driven component, lazy-loaded via `next/dynamic` in the server page. Schema change is a one-line Zod field addition. Content migration is moving 5 bullets from MDX body to YAML frontmatter.

---

## Phase 1: Schema [DONE]

### Overview

Add an optional `improvements` string array to `ChangelogEntrySchema` so frontmatter can declare improvement items validated at build time.

### Changes Required:

#### 1. Add `improvements` field to Zod schema

**File**: `apps/www/src/lib/content-schemas.ts`
**Changes**: Add `improvements` to `ChangelogEntrySchema`

```ts
export const ChangelogEntrySchema = ContentPageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/changelog/"))
    .optional(),
  version: z.string().min(1),
  type: z.enum(["feature", "improvement", "fix", "breaking"]),
  tldr: z.string().min(20).max(300),
  improvements: z.array(z.string().min(1)).optional(),
});
```

No changes needed to `ChangelogEntryData` (line 84) — it's inferred from the schema automatically. No changes needed to `source.config.ts`, `source.ts`, or any loader — the field flows through the pipeline as-is.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes — `ChangelogEntryData` now includes `improvements?: string[]`
- [x] `pnpm check` passes

#### Manual Verification:

- [x] N/A — schema-only change, no visible UI yet

---

## Phase 2: Component [DONE]

### Overview

Create a `ChangelogImprovements` client component that renders a single collapsible accordion section containing a bullet list of improvement items.

### Changes Required:

#### 1. Create accordion component

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/_components/changelog-improvements.tsx` (new file)
**Changes**: New `"use client"` component modeled after `FaqAccordion`

```tsx
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";

export function ChangelogImprovements({ items }: { items: string[] }) {
  return (
    <Accordion className="w-full" collapsible type="single">
      <AccordionItem
        className="border-border border-b last:border-b-0"
        value="improvements"
      >
        <AccordionTrigger
          className={cn(
            "flex w-full items-center justify-between py-6 text-left",
            "group hover:no-underline",
          )}
        >
          <span className="pr-4 font-medium text-base text-foreground">
            Improvements
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-6">
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                className="text-muted-foreground text-sm leading-relaxed"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes

#### Manual Verification:

- [x] N/A — component not yet wired to the page

---

## Phase 3: Detail Page Integration [DONE]

### Overview

Lazy-load and render `ChangelogImprovements` on the detail page, positioned after the MDX body and before the prev/next navigation.

### Changes Required:

#### 1. Add dynamic import and render improvements accordion

**File**: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
**Changes**:

Add dynamic import at the top of the file (after existing imports):

```ts
import dynamic from "next/dynamic";

const ChangelogImprovements = dynamic<{ items: string[] }>(() =>
  import("../_components/changelog-improvements").then((m) => ({
    default: m.ChangelogImprovements,
  })),
);
```

Add `improvements` to the destructured `page.data` (line 48-57):

```ts
const {
  title,
  version,
  type,
  publishedAt,
  authors,
  tldr,
  featuredImage,
  description,
  improvements,
} = page.data;
```

Render the accordion after the MDX body div (after the closing `</div>` at line ~131) and before the navigation `<nav>`:

```tsx
{improvements && improvements.length > 0 && (
  <div className="mt-12">
    <ChangelogImprovements items={improvements} />
  </div>
)}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:www` succeeds

#### Manual Verification:

- [ ] The accordion does not render yet (no frontmatter data exists) — page looks unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Content Migration [DONE]

### Overview

Move the 5 improvement items from the MDX body into frontmatter YAML and remove the `## Improvements` heading from the MDX body.

### Changes Required:

#### 1. Add improvements to frontmatter and remove from body

**File**: `apps/www/src/content/changelog/2026-03-26-initial.mdx`

Add to frontmatter (after the `faq` block, before the closing `---`):

```yaml
improvements:
  - "Real-time updates — entities and events stream live via SSE across all views"
  - "Jobs dashboard — monitor background workflows with live status, duration, and error details"
  - "Responsive sidebar — collapsible navigation with mobile support"
  - "Platform-aware shortcuts — Cmd on macOS, Ctrl on Windows and Linux"
  - "Command palette — navigate anywhere or search entities with Cmd+K"
```

Remove the `## Improvements` section from the MDX body (lines 96-103):

```markdown
## Improvements

- **Real-time updates** — entities and events stream live via SSE across all views
- **Jobs dashboard** — monitor background workflows with live status, duration, and error details
- **Responsive sidebar** — collapsible navigation with mobile support
- **Platform-aware shortcuts** — Cmd on macOS, Ctrl on Windows and Linux
- **Command palette** — navigate anywhere or search entities with Cmd+K
```

This entire block gets deleted.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm build:www` succeeds (Zod validates the new frontmatter at build time)
- [x] `pnpm check && pnpm typecheck` pass

#### Manual Verification:

- [ ] `/changelog/2026-03-26-initial` — no `## Improvements` heading in the body
- [ ] Collapsible "Improvements" accordion appears at the bottom, above prev/next nav
- [ ] Clicking the accordion trigger opens it with chevron rotation + slide animation
- [ ] All 5 items display as a list inside the expanded accordion
- [ ] Clicking again collapses it

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Automated:

- `pnpm build:www` — Zod schema validation + Next.js static generation covers the entire pipeline end-to-end
- `pnpm typecheck` — ensures `ChangelogEntryData` type propagation is correct
- `pnpm check` — lint + format

### Manual Testing Steps:

1. Navigate to `/changelog/2026-03-26-initial`
2. Scroll to the bottom — verify the "Improvements" accordion is visible below the MDX body
3. Click the accordion trigger — verify it expands with animation, chevron rotates
4. Verify all 5 items are listed
5. Click again — verify it collapses
6. Navigate to `/changelog` listing — verify no visual regression

## Performance Considerations

- `ChangelogImprovements` is lazy-loaded via `next/dynamic` so the Radix accordion JS is not in the critical path
- The accordion is below the fold on every changelog page — no layout shift impact

## References

- Research: `thoughts/shared/research/2026-04-10-changelog-improvements-accordion-redesign.md`
- Pattern: `apps/www/src/app/(app)/_components/faq-accordion.tsx` (data-driven accordion)
- Pattern: `apps/www/src/app/(app)/_components/faq-section.tsx` (lazy loading via `next/dynamic`)
- Schema: `apps/www/src/lib/content-schemas.ts:50-58`
- Detail page: `apps/www/src/app/(app)/(marketing)/(content)/changelog/[slug]/page.tsx`
- Content: `apps/www/src/content/changelog/2026-03-26-initial.mdx`
