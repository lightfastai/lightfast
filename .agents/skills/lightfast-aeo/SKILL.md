---
name: lightfast-aeo
description: |
  Use when authoring or reviewing any Lightfast content destined for AI engine retrieval —
  release notes, blog posts, docs pages, integration pages, anything published to the
  public site. Triggers on requests to write, draft, rewrite, or audit prose that should
  be cited by ChatGPT, Perplexity, Codex, Google AI Overviews, or other answer engines,
  even when the user doesn't say "AEO", "citations", or "answer engine". Per-content-type
  skills compose this for voice and section ordering — load this one too whenever they
  activate.
---

# Lightfast AEO

Apply these principles when writing or reviewing any Lightfast content. They are content-type agnostic. Per-type skills (e.g. `lightfast-changelog`) layer voice and section ordering on top — always load both.

## How AI engines retrieve

Engines retrieve at the **chunk level** — typically an H2 section — not the page. A user prompt fans out into ~2.4 sub-queries before retrieval; engines commonly add modifiers like *best*, *top*, *reviews*, and the current year. Engines cite ~4 sources per turn, ~6 per conversation. You compete for share-of-voice within a citation set, not a single slot.

The unit of optimization is the H2 section. Each must be self-contained, answerable in isolation, and phrased to match a fanout sub-query.

## Section structure

Every H2 follows this shape:

1. **Question heading** mirroring a fanout sub-query
2. **30–60 word direct answer** as the first paragraph — the most-extracted block
3. **2–3 atomic paragraphs** (1–3 sentences each, one idea each)
4. **Bullet list or table** of key facts
5. **Example, code, or screenshot** when applicable

Never open a section with filler ("In this section…", "Let's look at…", "Here's how…"). The first paragraph IS the answer.

Tables outperform prose for any comparative or grid-shaped data. Reach for them whenever data has rows and columns of meaning.

## Headings

Phrase H2s as questions. Generic noun headings get skipped by retrieval.

| Avoid | Prefer |
|---|---|
| `## Performance` | `## What performance improvements ship in this release?` |
| `## API` | `## How do I access this programmatically?` |
| `## Features` | Split into one H2 per feature, each phrased as a question |

Headings that include a number, percentage, or concrete stat get cited more often than purely descriptive phrasings.

## Trust block

Render near the top of every page:

- Author name + credentials (jobTitle in author markup)
- Published date and last-updated date
- 1–2 cited external sources where relevant
- 40–50 word TL;DR / answer summary

This is both the most-extracted block on the page and the model-readable proof of provenance. Bump the last-updated date on any content change — recency is an explicit ranking signal.

## FAQ

FAQ sections become FAQPage JSON-LD, the highest-impact structured data for citation. Treat the FAQ as a primary surface, not an afterthought. Per-type skills set the count target.

Rules:

- **Direct answers only.** Never "see our docs" or "learn more" — schema can't follow links.
- **1–3 sentences per answer.** Concise enough to be lifted whole into a model response.
- **Self-contained.** Each Q&A pair stands alone.
- **Conversational, not promotional.** Engines explicitly filter sales-y language.
- **Include the product name.** "Lightfast" should appear in answers for entity recognition.

Cover four categories: discovery (*What is X?*), mechanism (*How does X work?*), capability (*Can I do Y?*), specifics (*What integrations / parameters / data does X handle?*).

## Format and schema selection

| Format | Use when |
|---|---|
| **Comparative** (*X vs Y*, *Best X for Y*) | Evaluating options — among the highest-cited formats |
| **HowTo** schema | Procedural / step-by-step — largest single citation lift of any schema |
| **FAQPage** schema | Any piece with a Q&A section |
| **Article / BlogPosting** | Default for narrative |
| **TL;DR block** | Always |

Schema must match page intent. Generic `Article` schema on a page that's actually a HowTo or has a real FAQ underperforms accurate markup markedly.

## Length

Roughly 1,500–2,500 words for long-form. Per-type skills override. Don't pad to hit a count.

## Anti-patterns

- **Keyword stuffing.** Dead. Structure and clarity outweigh density.
- **Promotional language.** "Powerful", "seamless", "revolutionary", "best-in-class" — engines filter it. Write the way a senior engineer talks to a teammate.
- **Redirect-style FAQ answers.** Schema can't follow links; "see X" is invisible to retrieval.
- **Generic noun headings.** Don't match any fanout sub-query.
- **Paragraphs over 3 sentences.** Break chunk extraction.
- **Bundling features under one H2.** Each feature is a separate retrievable chunk — give each its own question-headed section.
- **Filler openings.** Waste the highest-value retrieval position.
- **Skipping the trust block.** Removes the only provenance signal.
- **Lazy alt text.** "Dashboard screenshot" is invisible. "Triage runtime dashboard showing 12 active workflows and 3 queued events" gets indexed.

## Workflow

1. Identify the content type. Load the matching per-type skill if one exists.
2. Frontmatter shape lives in the repo, not here. Discover the relevant schema (grep for it — content schemas are typically defined per content type). Don't memorize fields; they change.
3. Draft body and frontmatter following the structural rules above.
4. Validate via the repo's typecheck. Field constraints are enforced there.

## Sources

Methodology grounded in Profound's published research (tryprofound.com/blog) — chunk-level retrieval, query fanout, schema lift findings, the 2,000-page empirical citation study, and the ~700K-conversation citation drift research.
