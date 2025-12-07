# UI Structure Design Document — apps/www

This document codifies the design system for the Lightfast marketing website (`apps/www`). It serves as the root reference for designing components, ensuring consistency across all marketing pages.

---

## Overview

### Purpose
- Provide copy-paste patterns for common UI components
- Ensure visual consistency across all marketing pages
- Document Lightfast-specific adaptations of common patterns

### Design Philosophy
- **Minimalist**: Clean, focused layouts with generous whitespace
- **Semantic**: Meaningful hierarchy through typography and spacing
- **Lightfast-specific**: Consistent use of `rounded-xs`, accent backgrounds, and Exposure Trial typography

---

## Layout System

### Page Container Pattern

All marketing pages use this root container:

```tsx
<div className="mt-6 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
  {/* Sections go here */}
</div>
```

### Section Wrapper Pattern

Standard section wrapper for content blocks:

```tsx
<div className="max-w-6xl mx-auto w-full px-4">
  {/* Section content */}
</div>
```

For wider content (rare):
```tsx
<div className="max-w-7xl mx-auto w-full px-4">
  {/* Wide section content */}
</div>
```

### Hero Section — Centered

Used on landing page and feature pages:

```tsx
<div className="max-w-7xl mx-auto grid grid-cols-12">
  <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
    <section className="flex w-full flex-col items-center text-center">
      {/* Label */}
      <div className="mb-8 opacity-80">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Section Label
        </p>
      </div>

      {/* Heading */}
      <h1 className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}>
        Headline goes here
      </h1>

      {/* Description */}
      <div className="mt-4 px-4 w-full max-w-2xl">
        <p className="text-base text-muted-foreground">
          Description text goes here.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-8 flex flex-col justify-center gap-8 sm:flex-row">
        <Button asChild size="lg" className="rounded-full">
          <Link href="/early-access">Join Early Access</Link>
        </Button>
        <Link
          href="/docs/get-started/overview"
          className="group inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-foreground/80"
        >
          <span>Learn more</span>
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  </div>
</div>
```

### Hero Section — Split (Text + Media)

For feature pages with visual demos:

```tsx
<div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-center">
  {/* Text Column */}
  <div className="col-span-12 lg:col-span-5 lg:col-start-2">
    <div className="mb-8">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Section Label
      </p>
    </div>
    <h1 className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] ${exposureTrial.className}`}>
      Headline goes here
    </h1>
    <p className="mt-4 text-base text-muted-foreground">
      Description text goes here.
    </p>
    <div className="mt-8">
      <Button asChild size="lg" className="rounded-full">
        <Link href="/early-access">Join Early Access</Link>
      </Button>
    </div>
  </div>

  {/* Media Column */}
  <div className="col-span-12 lg:col-span-5">
    <div className="rounded-xs border border-border overflow-hidden">
      {/* Image, video, or demo component */}
    </div>
  </div>
</div>
```

---

## Grid Patterns

| Pattern | Classes | Use Case |
|---------|---------|----------|
| Centered content | `grid grid-cols-12` → `col-span-12 md:col-span-10 md:col-start-2` | Hero, narrow sections |
| Split layout | `col-span-12 lg:col-span-5` + `col-span-12 lg:col-span-5` | Hero with media |
| 2-column cards | `grid grid-cols-1 md:grid-cols-2 gap-8` | Capability grids |
| 3-column cards | `grid grid-cols-1 md:grid-cols-3 gap-6` | Feature cards |
| 4-column cards | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6` | Value props |

---

## Component Patterns

### Card — Standard

Default card with transparent border, hover effect:

```tsx
<div className="rounded-xs border border-transparent bg-card p-8 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
  <div className="mb-4">
    <Icon className="h-6 w-6 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-medium">{title}</h3>
  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
</div>
```

### Card — Accent

Card with accent background for emphasis:

```tsx
<div className="rounded-xs bg-accent/40 border border-border/40 p-8">
  <div className="mb-4">
    <Icon className="h-6 w-6 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-medium">{title}</h3>
  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
</div>
```

### Card — Bordered

Card with visible border, minimal background:

```tsx
<div className="rounded-xs border border-border p-6">
  <div className="mb-3">
    <Icon className="h-5 w-5 text-primary" />
  </div>
  <h3 className="text-lg font-medium">{title}</h3>
  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
</div>
```

### Card — Value Prop (with subgrid)

For aligned multi-row cards in a grid:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {items.map((item) => (
    <div key={item.title} className="grid grid-rows-subgrid gap-0 rounded-xs p-6 row-span-3 border border-border">
      <div className="mb-3">
        <item.icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-lg font-medium">{item.title}</h3>
      <p className="text-sm text-muted-foreground">{item.description}</p>
    </div>
  ))}
</div>
```

### Capability Grid

Standard 2-column capability display:

```tsx
const capabilities = [
  { icon: Bot, title: "MCP Tools", description: "..." },
  { icon: Code, title: "Simple REST API", description: "..." },
  { icon: Zap, title: "Streaming Responses", description: "..." },
  { icon: Shield, title: "Scoped Access", description: "..." },
];

<div className="max-w-5xl mx-auto w-full px-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
    {capabilities.map((capability) => (
      <div
        key={capability.title}
        className="flex flex-col gap-4 p-6 border border-border rounded-xs"
      >
        <capability.icon className="h-6 w-6 text-muted-foreground" />
        <h3 className="text-lg font-medium">{capability.title}</h3>
        <p className="text-sm text-muted-foreground">
          {capability.description}
        </p>
      </div>
    ))}
  </div>
</div>
```

### API Routes Display

For displaying API endpoints:

```tsx
const apiRoutes = [
  { method: "POST", path: "/v1/search", description: "Search and rank results" },
  { method: "POST", path: "/v1/contents", description: "Get full documents" },
  { method: "POST", path: "/v1/similar", description: "Find related content" },
  { method: "POST", path: "/v1/answer", description: "Get synthesized answers" },
];

<div className="max-w-5xl mx-auto w-full px-4">
  <div className="border border-border rounded-xs p-8 md:p-12">
    <h2 className={`text-xl md:text-2xl font-light mb-6 ${exposureTrial.className}`}>
      Four routes. That's it.
    </h2>
    <div className="space-y-4">
      {apiRoutes.map((route) => (
        <div
          key={route.path}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-border last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded-xs">
              {route.method}
            </span>
            <code className="text-sm font-mono">{route.path}</code>
          </div>
          <p className="text-sm text-muted-foreground sm:ml-auto">
            {route.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</div>
```

### Accordion with Image Swap (How-to Section)

For step-by-step guides with visual feedback:

```tsx
"use client";
import { useState } from "react";

const steps = [
  { id: "install", title: "Install the MCP tool", description: "...", image: "/images/step-1.png" },
  { id: "configure", title: "Configure your workspace", description: "...", image: "/images/step-2.png" },
  { id: "query", title: "Start querying", description: "...", image: "/images/step-3.png" },
];

function HowToSection() {
  const [activeStep, setActiveStep] = useState(steps[0].id);

  return (
    <div className="max-w-6xl mx-auto w-full px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Image Gallery */}
        <div className="relative aspect-video rounded-xs border border-border overflow-hidden">
          {steps.map((step) => (
            <Image
              key={step.id}
              src={step.image}
              alt={step.title}
              fill
              className={`object-cover transition-opacity duration-300 ${
                activeStep === step.id ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          <h2 className={`text-xl md:text-2xl font-light mb-8 ${exposureTrial.className}`}>
            How to use
          </h2>
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`w-full text-left p-4 rounded-xs border transition-all ${
                activeStep === step.id
                  ? "border-border bg-accent/20"
                  : "border-transparent hover:bg-accent/10"
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-sm font-mono text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-base font-medium">{step.title}</h3>
                  {activeStep === step.id && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Tab Section (Showcase)

For tabbed content with media panels:

```tsx
"use client";
import { useState } from "react";

const tabs = [
  { id: "search", label: "Search", content: <SearchDemo /> },
  { id: "answer", label: "Answer", content: <AnswerDemo /> },
  { id: "context", label: "Context", content: <ContextDemo /> },
];

function ShowcaseSection() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div className="max-w-6xl mx-auto w-full px-4">
      {/* Tab List */}
      <div className="flex gap-2 mb-8 overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="rounded-xs border border-border overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            hidden={activeTab !== tab.id}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### CTA Banner

Full-width call-to-action section:

```tsx
<section className="max-w-6xl mx-auto w-full px-4">
  <div className="bg-accent/40 rounded-xs py-16 px-8">
    <div className="flex w-full flex-col items-center justify-between gap-8 text-center lg:flex-row lg:text-start">
      <div className="max-w-[600px]">
        <h2 className={`text-xl md:text-2xl font-light ${exposureTrial.className}`}>
          Ready to get started?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Join the early access program and start building with Lightfast today.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="rounded-full">
          <Link href="/early-access">Join Early Access</Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="rounded-full">
          <Link href="/docs">View Documentation</Link>
        </Button>
      </div>
    </div>
  </div>
</section>
```

### Explore More Section

Navigation to related pages:

```tsx
const relatedPages = [
  { title: "For Teams", href: "/features/memory", description: "Search everything your team knows." },
  { title: "For Agents", href: "/features/agents", description: "Give your agents team memory." },
  { title: "Connectors", href: "/features/connectors", description: "Connect your existing tools." },
];

<div className="max-w-6xl mx-auto w-full px-4 mt-20">
  <h4 className="text-lg font-medium text-muted-foreground">Explore more</h4>
  <ul className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
    {relatedPages.map((page) => (
      <li key={page.href} className="flex flex-col gap-3">
        <Link
          href={page.href}
          className={`text-xl font-light hover:underline ${exposureTrial.className}`}
        >
          {page.title}
        </Link>
        <p className="text-sm text-muted-foreground">{page.description}</p>
      </li>
    ))}
  </ul>
</div>
```

---

## Typography Scale

| Element | Classes | Usage |
|---------|---------|-------|
| Hero H1 | `text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] ${exposureTrial.className}` | Page hero headlines |
| Section H2 | `text-xl md:text-2xl font-light ${exposureTrial.className}` | Section headlines |
| Card Title | `text-lg font-medium` | Card headers |
| Body | `text-base text-muted-foreground` | Descriptions, paragraphs |
| Small | `text-sm text-muted-foreground` | Card descriptions, secondary text |
| Label | `text-xs uppercase tracking-widest text-muted-foreground` | Section labels, tags |
| Mono | `text-sm font-mono` | Code, API routes |

### Font Import

```tsx
import { exposureTrial } from "~/lib/fonts";
```

---

## Button Patterns

| Type | Implementation | Use Case |
|------|----------------|----------|
| Primary CTA | `<Button size="lg" className="rounded-full">` | Main actions |
| Secondary CTA | `<Button variant="ghost" size="lg" className="rounded-full">` | Alternative actions |
| Link with Arrow | See below | Navigation, "Learn more" |

### Link with Arrow Pattern

```tsx
<Link
  href="/docs"
  className="group inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-foreground/80"
>
  <span>Learn more</span>
  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
</Link>
```

---

## Section Spacing

| Gap | Use Case |
|-----|----------|
| `gap-20` | Between major sections (page-level) |
| `gap-12` | Between subsections |
| `gap-10` | Within feature sections |
| `gap-8` | Card grids, moderate spacing |
| `gap-6` | Tight card grids |
| `gap-4` | Item lists, compact spacing |
| `gap-2` | Inline elements, tags |

### Vertical Margins

| Margin | Use Case |
|--------|----------|
| `mt-20` | Between major sections |
| `mt-12` | Subsection headers |
| `mt-8` | CTAs after content |
| `mt-4` | Descriptions after headings |
| `mt-2` | Secondary text after primary |

---

## Lightfast-Specific Rules

### Border Radius

**Always use `rounded-xs`** for:
- Cards
- Containers
- Inputs
- Media wrappers
- Badges

**Exception:** Buttons use `rounded-full`

```tsx
// Correct
<div className="rounded-xs border border-border">
<Button className="rounded-full">

// Never use
<div className="rounded-lg">  // Wrong
<div className="rounded-xl">  // Wrong
<div className="rounded-2xl"> // Wrong
```

### Background + Border Combinations

| Style | Background | Border | Use Case |
|-------|------------|--------|----------|
| Default | `bg-card` | `border-transparent` | Standard cards |
| Accent | `bg-accent/40` | `border-border/40` | Highlighted cards, CTAs |
| Bordered | `bg-transparent` | `border-border` | Simple containers |

### Hover States

```tsx
// Standard card hover
className="transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5"

// Accent card hover (no change typically)
className="bg-accent/40 border-border/40"

// Link hover
className="hover:text-foreground/80"
```

---

## Adaptations from External Patterns

When adapting patterns from other design systems (e.g., OpenAI), apply these transformations:

| External Pattern | Lightfast Adaptation |
|------------------|---------------------|
| `rounded-2xl` | `rounded-xs` |
| `rounded-xl` | `rounded-xs` |
| `rounded-lg` | `rounded-xs` |
| `rounded-md` | `rounded-xs` |
| Custom heading classes | Explicit Tailwind + `exposureTrial.className` |
| Token-based colors | Tailwind semantic colors (`bg-card`, `text-muted-foreground`) |
| Very wide max-widths | `max-w-6xl` (narrower, more focused) |
| Custom button classes | `<Button>` component with `rounded-full` |

---

## Quick Reference

### Page Template

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createMetadata } from "@vendor/seo/metadata";
import { Button } from "@repo/ui/components/ui/button";
import { exposureTrial } from "~/lib/fonts";

export const metadata: Metadata = createMetadata({
  title: "Page Title | Lightfast",
  description: "Page description.",
  openGraph: {
    title: "Page Title",
    description: "Page description.",
    url: "https://lightfast.ai/page",
    type: "website",
  },
  alternates: {
    canonical: "https://lightfast.ai/page",
  },
});

export default function Page() {
  return (
    <div className="mt-6 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
      {/* Hero Section */}
      {/* ... */}

      {/* Content Sections */}
      {/* ... */}

      {/* CTA Section */}
      {/* ... */}
    </div>
  );
}
```

### Checklist

Before shipping a new marketing page:

- [ ] Uses `rounded-xs` for all containers (except buttons)
- [ ] Buttons use `rounded-full`
- [ ] Headlines use `exposureTrial.className`
- [ ] Cards use approved background/border combos
- [ ] Page wrapped in standard container pattern
- [ ] Sections use `gap-20` spacing
- [ ] Includes proper metadata with canonical URL
- [ ] CTA links to `/early-access` or relevant page
- [ ] Mobile-responsive grid breakpoints tested
