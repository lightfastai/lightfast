---
date: 2026-03-23T00:00:00+11:00
author: claude
git_commit: b48ba6d2efab7ba3dd9146479ddaaa0f02116f89
branch: main
topic: "Add 'superintelligence layer for founders' as primary headline; retain 'operating layer' as supporting narrative"
tags: [marketing, copy, www, positioning]
status: ready
---

# Plan: Superintelligence Layer Marketing Rework

## Decision

Add **"Superintelligence layer for founders"** as the primary headline positioning. The **"operating layer"** is retained throughout marketing copy as the mechanism that powers the superintelligence layer — it explains HOW Lightfast works. The narrative hierarchy is: superintelligence is the WHAT, operating layer is the HOW.

## Canonical Messaging

```
H1:  Superintelligence layer for founders.
Sub: Built on a unified operating layer — your tools, your agents, your entire
     operation orchestrated in one place.
```

## What Does NOT Change

- `README.md` — stays as-is (already has correct tagline, operating layer section is accurate)
- `CLAUDE.md` — internal dev docs, no marketing changes needed
- `apps/www/src/content/docs/` — technical documentation stays as-is
- Homepage benefit cards (all 6) — stay as-is
- Homepage "Connect Your Tools" section intro — stays as-is
- FAQ 2 ("What does 'operating layer' mean?") — stays as-is
- FAQ 3–5, 7–9 — stay as-is
- Use case card content (the 25–30 items per page) — stays as-is
- Visual design — separate pass once copy is locked

---

## Phase 1: Homepage — Hero + Metadata

**File**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`

### 1a. Hero Section (lines 269–275)

**Current:**
```jsx
<h1 className="mb-4 font-medium font-pp text-4xl md:text-3xl lg:text-3xl">
  <span className="text-muted-foreground">The</span>{" "}
  <span className="text-primary">operating layer</span>{" "}
  <span className="text-muted-foreground">
    for your agents and apps.
  </span>
</h1>
```

**New:**
```jsx
<h1 className="mb-4 font-medium font-pp text-4xl md:text-3xl lg:text-3xl">
  <span className="text-primary">Superintelligence</span>{" "}
  <span className="text-muted-foreground">layer for founders.</span>
</h1>
<p className="mb-4 max-w-sm text-sm text-muted-foreground leading-relaxed">
  Built on a unified operating layer — your tools, your agents, your entire
  operation orchestrated in one place.
</p>
```

### 1b. Metadata (lines 62–113)

| Field | Current | New |
|-------|---------|-----|
| `metadata.title` | `"The Operating Layer for Agents and Apps"` | `"Superintelligence Layer for Founders"` |
| `metadata.description` | "Lightfast is the operating layer between your agents and apps…" | "Lightfast is the superintelligence layer for founders. Built on a unified operating layer that connects your tools, unifies your agents, and orchestrates your entire operation." |
| `metadata.keywords` | includes "operating layer", "operating infrastructure" | Add: `"superintelligence"`, `"AI for founders"`, `"founder tools"`. Keep existing keywords. |
| `openGraph.title` | `"Lightfast – The Operating Layer for Agents and Apps"` | `"Lightfast – Superintelligence Layer for Founders"` |
| `openGraph.description` | "The operating layer between your agents and apps…" | "The superintelligence layer for founders. Built on a unified operating layer — your tools, your agents, your entire operation orchestrated in one place." |
| `twitter.title` | same as OG | same as new OG |
| `twitter.description` | same as OG | same as new OG |

### 1c. JSON-LD Structured Data (lines 117–195)

| Entity | Field | New |
|--------|-------|-----|
| `organizationEntity` | `description` | "Lightfast is the superintelligence layer for founders. Built on a unified operating layer that connects tools, unifies agents, and orchestrates entire operations through one system." |
| `websiteEntity` | `description` | "Superintelligence layer for founders — built on a unified operating layer to observe, remember, and act across every tool." |
| `softwareEntity` | `description` | "The superintelligence layer for founders. Built on a unified operating layer — observe events, build memory, and orchestrate action across your entire tool stack through a single system." |

---

## Phase 2: FAQ Section

**File**: `apps/www/src/app/(app)/_components/faq-section.tsx`

### 2a. Section header (line 77)

**Current:** `"Learn how the operating layer works."`
**New:** `"Learn how Lightfast works."`

### 2b. FAQ 1 — minor update

**Current question:** `"What is Lightfast?"`
**Current answer:** `"Lightfast is the operating layer between your agents and apps…"`

**New answer:**
```
Lightfast is the superintelligence layer for founders. Built on a unified
operating layer, it observes what's happening across your tools, remembers what
happened, and gives agents and people a single system to reason and act through
— without knowing which tools exist or how they work.
```

### 2c. FAQ 6 — minor update

**Current answer:** references "…the full Operating Layer: agents express what they want…"

**New answer:**
```
Next is Memory — semantic search and cited answers across your entire tool stack.
Everything from the event system gets indexed, connected, and made searchable
by meaning. After that, full orchestration: agents express what they want in
natural language, and Lightfast resolves it to the right tool, enforces your
rules, and tracks everything.
```

All other FAQs (2–5, 7–9) stay exactly as-is.

---

## Phase 3: Use Case Pages

**File pattern**: `apps/www/src/app/(app)/(marketing)/(content)/use-cases/[persona]/page.tsx`

Light-touch: update metadata titles only. Descriptions and hero content stay as-is where they already work. "Operating layer" in descriptions is fine.

### technical-founders/page.tsx

| Field | Current | New |
|-------|---------|-----|
| `metadata.title` | "Lightfast for Technical Founders – The Operating Layer for Your Stack" | "Lightfast for Technical Founders – Superintelligence for Your Stack" |

### agent-builders/page.tsx

- Read current copy, update title to lead with superintelligence framing
- Keep "operating layer" in descriptions

### engineering-leaders/page.tsx

- Read current copy, update title to lead with superintelligence framing
- Keep "operating layer" in descriptions

### platform-engineers/page.tsx

- Read current copy, update title to lead with superintelligence framing
- Keep "operating layer" in descriptions

---

## Phase 4: Pricing Page Audit

**File**: `apps/www/src/app/(app)/(marketing)/(content)/pricing/page.tsx`

- Read and audit for any changes needed
- Likely no changes — pricing copy describes tiers, not positioning

---

## Implementation Order

```
1. page.tsx (homepage hero + metadata + JSON-LD)   — 15 min
2. faq-section.tsx (header + FAQ 1 + FAQ 6)        — 10 min
3. technical-founders/page.tsx (title only)         — 2 min
4. agent-builders/page.tsx (read + title)           — 5 min
5. engineering-leaders/page.tsx (read + title)      — 5 min
6. platform-engineers/page.tsx (read + title)       — 5 min
7. pricing/page.tsx (audit only)                    — 5 min
```

## Success Criteria

- Hero h1: "Superintelligence layer for founders."
- Hero sub-text: "Built on a unified operating layer — your tools, your agents, your entire operation orchestrated in one place."
- Metadata title leads with "Superintelligence" (not "Operating Layer")
- "Operating layer" is retained in body copy, FAQs, and descriptions as the HOW
- FAQ 1 introduces Lightfast as "superintelligence layer" first, then references operating layer
- All 4 use case page titles lead with superintelligence framing

---

## Update Log

### 2026-03-23 — Retain operating layer language
- **Trigger**: User decided to maintain "operating layer" language alongside "superintelligence layer" instead of replacing it
- **Changes**:
  - Removed Phase 1 (README.md) — stays as-is
  - Simplified Phase 2 (Homepage) — hero + metadata only, benefit cards and section intro unchanged
  - Simplified Phase 3 (FAQ) — only FAQ 1, FAQ 6, and section header change; FAQ 2 stays
  - Simplified Phase 4 (Use Cases) — title-only changes
  - Updated canonical sub-text: "Built on a unified operating layer — your tools, your agents, your entire operation orchestrated in one place."
  - Removed success criterion "zero instances of operating layer"
- **Impact**: ~50% reduction in scope. Narrative shifts from "replace" to "layer on top"
