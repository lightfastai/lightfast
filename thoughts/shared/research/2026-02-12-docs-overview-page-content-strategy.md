---
date: 2026-02-12T18:00:00+08:00
researcher: Claude
git_commit: 7e5a1c51ccd74f72099eafdaa6c8bded05a42048
branch: feat/landing-page-grid-rework
repository: lightfast-search-perf-improvements
topic: "Docs overview page content strategy - reference site analysis"
tags: [research, docs, content-strategy, overview-page, developer-experience]
status: complete
last_updated: 2026-02-12
last_updated_by: Claude
---

# Research: Docs Overview Page Content Strategy

**Date**: 2026-02-12
**Researcher**: Claude
**Git Commit**: 7e5a1c51
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast-search-perf-improvements

## Research Question

What should go in the `apps/docs/src/content/docs/get-started/overview.mdx` page? Analyze reference sites (OpenAI Codex, OpenAI API docs, ElevenLabs Agents, Claude Code) for content strategy patterns.

## Summary

The four reference sites reveal a clear pattern: **the best overview pages are routing hubs, not encyclopedias**. They lead with a single-sentence value prop, offer environment-specific entry points, and push all detail to deeper pages. The current Lightfast overview is far too long — it duplicates content from the quickstart, API reference, and features sections.

---

## Reference Site Analysis

### 1. OpenAI Codex (`developers.openai.com/codex`)

**Structure**: Minimal landing page — functions as a routing hub.

| Section | Content |
|---------|---------|
| Hero | "One agent for everywhere you code" + product screenshots |
| Value prop | 5 capabilities listed (code gen, understanding, review, debugging, automation) |
| CTAs | 3 buttons: "Get started with Codex", "Explore", "Join Discord" |

**Key pattern**: Almost zero technical content on the overview itself. All substance lives on linked pages (`/codex/quickstart`, `/codex/explore`, platform-specific guides). The overview is a **wayfinding page**.

**Sidebar structure**: Getting Started → Using Codex → Configuration → Administration → Automation → Learn → Releases

---

### 2. OpenAI API Docs (`developers.openai.com/docs/overview`)

**Structure**: Hierarchical funnel — immediate code examples first, then discovery cards.

| Section | Content |
|---------|---------|
| Hero | "Developer quickstart" with inline code examples in 4 languages |
| Models | 3 featured models with brief descriptions |
| Start Building | 8 capability-focused cards linking to guides |
| Support | Help center, forum, cookbook, status page |

**Key pattern**: Code examples appear immediately (in tabs for multiple languages). The page is **action-oriented** — it assumes developers want to build, not read. Cards provide shallow entry points to 60+ deeper pages.

**Sidebar structure**: Get Started (7) → Core Concepts (7) → Agents (3) → Tools (10+) → Run & Scale (5) → Model Optimization (8) → Going Live (3)

---

### 3. ElevenLabs Agents (`elevenlabs.io/docs/eleven-agents/overview`)

**Structure**: Hub page with 3-card navigation pattern.

| Section | Content |
|---------|---------|
| Hero | "Learn how to build, launch, and scale agents with ElevenLabs" |
| Value prop | Agents accomplish tasks through natural dialogue |
| 3 Cards | Configure → Deploy → Monitor (with visuals) |
| Capability tables | 3 tables listing 22 topics, each linking to deeper docs |
| Architecture | Brief 4-component description (ASR, LLM, TTS, turn-taking) |
| CTA | Quickstart card (5-minute setup) |

**Key pattern**: **No code examples on the overview page**. Zero. All code lives on the linked pages. The overview is purely conceptual orientation + wayfinding. The 3-card pattern (Configure/Deploy/Monitor) maps to the developer lifecycle.

---

### 4. Claude Code (`code.claude.com/docs/en/overview`)

**Structure**: Environment-first onboarding with expandable capability showcase.

| Section | Content |
|---------|---------|
| Hero | One sentence: "Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands..." |
| Get started | **Tabbed installer** — Terminal, VS Code, Desktop, Web, JetBrains — each with install commands |
| What you can do | **Accordion group** — 8 expandable sections with code examples hidden inside |
| Use everywhere | Table mapping "I want to..." → "Best option" |
| Next steps | 5 bullet links to deeper docs |

**Key pattern**: The overview page IS the getting-started page. There's no separate "overview" vs "quickstart" — it's one page that gets you installed and then shows what's possible. Code examples are **inside accordions** so the page stays scannable. The environment tabs are the star — they let each developer find their path immediately.

---

## Current Lightfast Overview Analysis

**File**: `apps/docs/src/content/docs/get-started/overview.mdx` (233 lines)

**Routing**: `/docs` redirects to `/docs/get-started/overview` via hard-coded redirect in `page.tsx` (line 52-55). A custom `DeveloperPlatformLanding` component renders the landing experience. The file `docs/index.mdx` exists but is **dead code** — not in any `meta.json`, not in `.source/index.ts`, never rendered.

### Problems identified by reference comparison:

1. **Too much content**: 233 lines vs Claude Code's focused approach. The page tries to be overview, API reference, feature list, quickstart, and marketing page simultaneously.

2. **Duplicated content**: The "Four API Routes" section duplicates what's in the API reference. The "How It Works" section duplicates the quickstart. The "Key Features" section duplicates the features pages.

3. **No clear entry point**: Unlike Claude Code's tabbed installer or OpenAI's immediate code examples, Lightfast's overview doesn't give developers an obvious first action.

4. **Code examples too deep for an overview**: Full TypeScript snippets with config objects belong on the quickstart or API reference pages, not the overview.

5. **Two "Next Steps" sections**: Lines 175-197 and 213-232 both try to route users forward.

6. **"What Makes Lightfast Different?" at the bottom**: Differentiation content (hybrid retrieval, multi-view embeddings, graph reasoning) is buried at line 199+. This is either marketing page content or features page content — not overview material.

---

## Current Docs Structure

```
docs/
├── index.mdx                    # Docs homepage (also duplicates overview content)
├── meta.json                    # Root nav: [get-started, integrate, features]
├── get-started/
│   ├── meta.json                # [overview, quickstart, config]
│   ├── overview.mdx             # ← THE PAGE IN QUESTION (233 lines)
│   ├── quickstart.mdx           # 5-min setup guide
│   └── config.mdx               # lightfast.yml reference
├── features/
│   ├── index.mdx                # Features overview
│   ├── search.mdx, memory.mdx, relationships.mdx,
│   ├── citations.mdx, quality.mdx, security.mdx
│   └── meta.json
└── integrate/
    ├── sdk.mdx, mcp.mdx
    └── meta.json
```

**Note**: `index.mdx` and `overview.mdx` have significant content overlap — both explain what Lightfast is, list the 4 API routes, and provide navigation cards.

---

## Patterns Across All Four Reference Sites

| Pattern | OpenAI Codex | OpenAI API | ElevenLabs | Claude Code |
|---------|-------------|-----------|------------|-------------|
| Page length | Very short | Medium | Medium | Medium-long |
| Code on overview | None | Yes (hero) | None | In accordions |
| Primary pattern | Routing hub | Code-first funnel | 3-card hub | Tabbed installer |
| Separate overview/quickstart? | Yes | Combined | Yes | Combined |
| Feature list on overview? | 5 bullets | 8 cards | 3 categories | 8 accordions |
| Architecture diagram? | No | No | Brief text | No |
| API details on overview? | No | No | No | No |

### Universal patterns:

1. **Single-sentence value prop** at the top
2. **Environment/path selection** early (tabs, cards, or buttons)
3. **API details live elsewhere** — never on the overview
4. **Progressive disclosure** — accordions, tabs, cards that link deeper
5. **Clear next step** — one primary CTA, not multiple competing ones

---

## Code References

- `apps/docs/src/content/docs/get-started/overview.mdx` — Current overview page (233 lines)
- `apps/docs/src/content/docs/index.mdx` — DEAD CODE: not in any meta.json, never rendered
- `apps/docs/src/content/docs/get-started/quickstart.mdx` — Quickstart guide (142 lines)
- `apps/docs/src/content/docs/get-started/meta.json` — Navigation config
- `apps/docs/src/content/docs/meta.json` — Root navigation

## Open Questions

1. `index.mdx` is dead code — should it be deleted? `/docs` already redirects to `/docs/get-started/overview`.
2. Should the overview page include install/setup code (like Claude Code), or be purely a routing hub (like ElevenLabs)?
3. The "What Makes Lightfast Different?" content (hybrid retrieval, multi-view embeddings, graph reasoning) — should this move to the marketing site (`apps/www`) or to `features/index.mdx`?
4. Should the 4 API routes be removed from overview entirely and only live in the API reference section?
