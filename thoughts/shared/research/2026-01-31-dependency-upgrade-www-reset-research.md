---
date: 2026-01-31T10:30:00+11:00
researcher: Claude
git_commit: 4d6efb4e2d6bde3aee5889567dad61392b0c19dd
branch: feat/landing-page-grid-rework
repository: lightfast
topic: "Full dependency upgrade and apps/www reset to blank TanStack project"
tags: [research, codebase, dependencies, upgrade, www, tanstack]
status: complete
last_updated: 2026-01-31
last_updated_by: Claude
---

# Research: Full Dependency Upgrade and apps/www Reset

**Date**: 2026-01-31T10:30:00+11:00
**Researcher**: Claude
**Git Commit**: 4d6efb4e2d6bde3aee5889567dad61392b0c19dd
**Branch**: feat/landing-page-grid-rework
**Repository**: lightfast

## Research Question

Document the current state of all dependencies across the monorepo and the apps/www structure in preparation for:
1. Full upgrade of all dependencies to latest versions
2. Reset of apps/www to a blank TanStack project

## Summary

The Lightfast monorepo contains **72+ packages** across 8 workspace directories with complex interdependencies. The codebase uses:
- **Next.js 15/16** with App Router
- **React 19.2.1** with React DOM
- **TanStack Query 5.80.7** for data fetching (via tRPC)
- **tRPC 11.4.0** for type-safe APIs
- **Tailwind CSS 4.1.11** for styling
- **TypeScript 5.8.2+** throughout

The `apps/www` is a Next.js 16 marketing site with 51+ components, BaseHub CMS integration, and no TanStack Query usage (it's a static marketing site).

---

## Detailed Findings

### 1. Root Package Configuration

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/package.json`

**Engine Requirements**:
- Node.js >= 22.0.0
- pnpm 10.5.2

**Root DevDependencies**:
| Package | Version |
|---------|---------|
| @changesets/cli | ^2.29.5 |
| @lightfastai/dual | ^1.2.2 |
| @repo/prettier-config | workspace:* |
| envmcp | ^0.2.1 |
| keytar | ^7.9.0 |
| prettier | catalog: |
| turbo | catalog: |
| turbo-ignore | ^2.5.5 |
| typescript | ^5.9.2 |
| typescript-eslint | ^8.46.1 |
| vite | ^6.3.5 |

**pnpm Overrides** (React 19 forced across monorepo):
```json
{
  "react": "^19.2.1",
  "react-dom": "^19.2.1",
  "@types/react": "^19.1.11",
  "@types/react-dom": "^19.1.8"
}
```

---

### 2. Workspace Catalog Dependencies

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/pnpm-workspace.yaml`

**Core Framework (catalog:)**:
| Package | Version |
|---------|---------|
| next | ^15.5.7 |
| @tanstack/react-query | ^5.80.7 |
| @trpc/client | ^11.4.0 |
| @trpc/server | ^11.4.0 |
| @trpc/tanstack-react-query | ^11.4.0 |

**AI SDK Stack**:
| Package | Version |
|---------|---------|
| @ai-sdk/anthropic | 2.0.4 |
| @ai-sdk/gateway | 1.0.7 |
| @ai-sdk/provider | 2.0.0 |
| @ai-sdk/react | 2.0.15 |
| ai | 5.0.15 |

**Authentication (Clerk)**:
| Package | Version |
|---------|---------|
| @clerk/backend | 2.18.1 |
| @clerk/elements | 0.23.63 |
| @clerk/nextjs | 6.33.5 |
| @clerk/shared | 3.28.0 |
| @clerk/themes | 2.4.19 |
| @clerk/types | 4.52.0 |

**Database & ORM**:
| Package | Version |
|---------|---------|
| drizzle-orm | ^0.43.1 |
| drizzle-zod | ^0.7.1 |

**Infrastructure**:
| Package | Version |
|---------|---------|
| @upstash/redis | ^1.35.1 |
| redis | ^5.6.0 |
| inngest | ^3.35.1 |
| @inngest/middleware-sentry | ^0.1.2 |

**UI & Forms**:
| Package | Version |
|---------|---------|
| lucide-react | ^0.451.0 |
| react-hook-form | ^7.61.1 |
| @hookform/resolvers | ^3.10.0 |
| zustand | ^5.0.7 |
| geist | ^1.3.1 |

**Utilities**:
| Package | Version |
|---------|---------|
| zod | ^3.25.76 (catalog:zod3) |
| zod | ^4.0.0 (catalog:zod4) |
| neverthrow | ^8.2.0 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.3.1 |
| nanoid | ^5.1.5 |
| superjson | ^2.2.1 |

**Tailwind CSS v4 (catalog:tailwind4)**:
| Package | Version |
|---------|---------|
| tailwindcss | 4.1.11 |
| postcss | 8.5.6 |
| @tailwindcss/postcss | 4.1.11 |
| @tailwindcss/typography | ^0.5.16 |

**Next.js Catalogs**:
| Catalog | Package | Version |
|---------|---------|---------|
| next15 | next | ^15.5.7 |
| next16 | next | ^16.1.6 |

---

### 3. Apps Directory (5 applications)

#### 3.1 apps/console (`@lightfast/console`)
**Purpose**: AI workflow orchestration platform (default microfrontend)
**Port**: 4107
**Next.js**: catalog:next15 (^15.5.7)

**Key Dependencies (66 total)**:
- tRPC + TanStack Query stack
- Clerk authentication
- Drizzle ORM
- GitHub integration (Octokit)
- Pinecone vector DB
- Recharts for visualization
- 14 @repo/console-* internal packages

#### 3.2 apps/auth (`@lightfast/auth`)
**Purpose**: Dedicated authentication app with Clerk Elements
**Port**: 4104
**Next.js**: catalog:next15 (^15.5.7)

**Key Dependencies (28 total)**:
- Clerk Elements + Themes
- Svix webhooks
- No TanStack Query (server-side auth flows)

#### 3.3 apps/chat (`@lightfast/chat`)
**Purpose**: AI chat application (independent, not in microfrontends)
**Port**: 4106
**Next.js**: catalog:next15 (^15.5.7)

**Key Dependencies (64 total)**:
- Vercel AI SDK + Anthropic
- tRPC + TanStack Query
- Braintrust evaluations
- Mermaid diagrams
- Shiki syntax highlighting

#### 3.4 apps/docs (`@lightfast/docs`)
**Purpose**: Documentation site with Fumadocs
**Port**: 4105
**Next.js**: catalog:next15 (^15.5.7)

**Key Dependencies (26 total)**:
- Fumadocs (core, MDX, OpenAPI, UI)
- MixedBread AI SDK for semantic search
- No TanStack Query

#### 3.5 apps/www (`@lightfast/www`)
**Purpose**: Marketing website
**Port**: 4101
**Next.js**: catalog:next16 (^16.1.6) - **Only app using Next.js 16**

**Key Dependencies (50 total)**:
- BaseHub CMS (^9.5.2)
- UnicornStudio WebGL (2.0.1-1)
- Paper Design Shaders (0.0.71)
- Framer Motion (^11.18.2)
- jsPDF + html2canvas (PDF generation)
- Jotai state management (^2.12.3)
- **No TanStack Query** (static marketing site)

---

### 4. Vendor Packages (16 packages)

All vendor packages wrap third-party SDKs following the rule: "Never import third-party SDKs directly → use @vendor/* packages"

| Package | Wraps | Key Versions |
|---------|-------|--------------|
| @vendor/analytics | PostHog, Vercel Analytics | posthog-js ^1.302.2 |
| @vendor/clerk | Clerk | @clerk/nextjs catalog: |
| @vendor/cms | BaseHub | basehub ^9.5.2 |
| @vendor/db | PlanetScale, Drizzle | drizzle-orm catalog: |
| @vendor/email | Resend | resend ^4.3.0 |
| @vendor/embed | Cohere, OpenAI | cohere-ai ^7.19.0 |
| @vendor/inngest | Inngest | inngest catalog: |
| @vendor/mastra | Mastra | @mastra/core ^0.9.0 |
| @vendor/next | Next.js plugins | @sentry/nextjs ^10.20.0 |
| @vendor/observability | Sentry, BetterStack | @logtail/next ^0.2.0 |
| @vendor/pinecone | Pinecone | @pinecone-database/pinecone ^6.1.3 |
| @vendor/security | Arcjet, Nosecone | @arcjet/next 1.0.0-beta.10 |
| @vendor/seo | Schema.org | schema-dts ^1.1.5 |
| @vendor/storage | Vercel Blob | @vercel/blob ^1.1.1 |
| @vendor/upstash | Upstash Redis | @upstash/redis ^1.35.1 |
| @vendor/upstash-workflow | Upstash Workflow | @upstash/workflow ^0.2.22 |

---

### 5. Shared Packages (35+ packages)

#### packages/* (35 packages)
Key packages with external dependencies:

| Package | Purpose | Key External Deps |
|---------|---------|-------------------|
| @repo/ui | UI component library | 50+ Radix UI components, recharts, shiki |
| @repo/ai | AI/LLM integrations | @ai-sdk/*, braintrust, exa-js |
| @repo/ai-tools | Browser automation | @browserbasehq/stagehand, playwright |
| @repo/email | Email templates | @react-email/components, react-email |
| @repo/console-trpc | tRPC for console | @trpc/*, @tanstack/react-query |
| @repo/chat-trpc | tRPC for chat | @trpc/*, @tanstack/react-query |

#### core/* (4 packages)
| Package | Purpose | Key Deps |
|---------|---------|----------|
| @lightfastai/cli | CLI tool | commander, chalk, ora |
| lightfast | Neural Memory SDK | (no external deps) |
| @lightfastai/ai-sdk | AI agents SDK | ai, @ai-sdk/*, @upstash/* |
| @lightfastai/mcp | MCP server | @modelcontextprotocol/sdk |

#### api/* (2 packages)
| Package | Purpose | Key Deps |
|---------|---------|----------|
| @api/console | Console tRPC API | 41 deps including tRPC, Inngest |
| @api/chat | Chat tRPC API | 29 deps including tRPC, Inngest |

#### db/* (2 packages)
| Package | Purpose | Key Deps |
|---------|---------|----------|
| @db/console | Console Drizzle schema | drizzle-orm, postgres |
| @db/chat | Chat Drizzle schema | drizzle-orm, @vendor/db |

---

### 6. TanStack Query Usage

TanStack Query (`@tanstack/react-query` ^5.80.7) is used exclusively through tRPC integration:

**Packages using TanStack**:
- `packages/console-trpc/` - React Query provider for console
- `packages/chat-trpc/` - React Query provider for chat
- `api/console/` - tRPC router with React Query
- `api/chat/` - tRPC router with React Query

**Apps using TanStack** (54 files total):
- `apps/console/` - 30+ components with useQuery/useMutation
- `apps/chat/` - 20+ hooks and components

**Apps NOT using TanStack**:
- `apps/www/` - Static marketing site
- `apps/auth/` - Server-side auth flows
- `apps/docs/` - Static documentation

---

### 7. apps/www Complete Structure

**Directory Structure**:
```
apps/www/
├── package.json           # Next.js 16, 50 deps
├── next.config.ts         # Microfrontends, Sentry, transpilation
├── tsconfig.json          # Path aliases ~/*, @/*, @vendor/cms/*
├── eslint.config.js       # Flat config
├── postcss.config.mjs     # Tailwind v4
├── turbo.json             # Build config
├── vercel.json            # Deployment
├── src/
│   ├── app/               # Next.js App Router (30+ pages)
│   │   ├── layout.tsx     # Root layout with providers
│   │   ├── (app)/
│   │   │   ├── (marketing)/
│   │   │   │   ├── layout.tsx     # Navbar + fixed footer
│   │   │   │   ├── (landing)/page.tsx  # Homepage
│   │   │   │   ├── (content)/     # Blog, changelog, pricing
│   │   │   │   ├── features/      # Feature pages
│   │   │   │   ├── use-cases/     # Use case pages
│   │   │   │   └── legal/         # Terms, privacy
│   │   │   ├── (internal)/pitch-deck/  # Pitch deck
│   │   │   ├── (search)/          # Search page
│   │   │   └── early-access/      # Early access
│   │   └── (health)/api/health/   # Health check
│   ├── components/        # 51 component files
│   ├── config/            # Navigation, pitch deck data
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities, feeds
│   ├── styles/            # globals.css with themes
│   ├── types/             # TypeScript types
│   ├── env.ts             # Environment validation
│   ├── middleware.ts      # Security, CSP
│   └── instrumentation.ts # Sentry
└── public/                # Fonts (18), images (10+)
```

**Key www Dependencies**:
| Category | Package | Version |
|----------|---------|---------|
| Framework | next | catalog:next16 (^16.1.6) |
| React | react, react-dom | 19.2.1 |
| CMS | basehub | ^9.5.2 |
| Animation | framer-motion | ^11.18.2 |
| WebGL | unicornstudio-react | 2.0.1-1 |
| Shaders | @paper-design/shaders-react | 0.0.71 |
| State | jotai | ^2.12.3 |
| State | zustand | catalog: |
| URL State | nuqs | ^2.8.0 |
| PDF | jspdf | ^2.5.2 |
| PDF | html2canvas-pro | ^1.6.6 |
| Forms | react-hook-form | catalog: |
| Validation | zod | catalog:zod3 |
| Icons | lucide-react | catalog: |
| Styling | tailwindcss | catalog:tailwind4 |

**www Does NOT Use**:
- TanStack Query (no @tanstack/* imports)
- tRPC (no API layer)
- Drizzle ORM (no database)
- Clerk (no authentication - handled by apps/auth)

---

### 8. Cross-Cutting Patterns

**Workspace Protocol Usage**:
- `workspace:*` - Exact version match within monorepo
- `workspace:^` - Compatible version range

**Catalog Protocol Usage**:
- `catalog:` - Default catalog (pnpm-workspace.yaml)
- `catalog:tailwind4` - Tailwind CSS v4 versions
- `catalog:zod3` - Zod 3.x versions
- `catalog:zod4` - Zod 4.x versions (not actively used)
- `catalog:next15` - Next.js 15.x
- `catalog:next16` - Next.js 16.x (only www)
- `catalog:react19` - React 19.x types

**Common DevDependencies** (all packages):
- @repo/eslint-config: workspace:*
- @repo/prettier-config: workspace:*
- @repo/typescript-config: workspace:*
- eslint: catalog:
- prettier: catalog:
- typescript: catalog:

---

## Code References

### Root Configuration
- `package.json:1-67` - Root package with overrides
- `pnpm-workspace.yaml:1-105` - Workspace and catalog config

### Apps
- `apps/www/package.json:1-95` - www dependencies
- `apps/www/next.config.ts:1-85` - Next.js 16 configuration
- `apps/www/src/app/layout.tsx:1-162` - Root layout
- `apps/console/package.json` - Console dependencies (66 deps)
- `apps/chat/package.json` - Chat dependencies (64 deps)

### TanStack Integration
- `packages/console-trpc/src/react.tsx` - Console React Query provider
- `packages/chat-trpc/src/react.tsx` - Chat React Query provider

### Vendor Abstractions
- `vendor/*/package.json` - All 16 vendor packages

---

## Architecture Documentation

### Monorepo Structure
```
lightfast/
├── apps/           # 5 Next.js applications
├── api/            # 2 tRPC API packages
├── db/             # 2 Drizzle schema packages
├── packages/       # 35+ shared packages
├── core/           # 4 SDK packages
├── vendor/         # 16 third-party abstractions
└── internal/       # 3 tooling configs
```

### Dependency Flow
```
apps/* → @repo/* → @vendor/* → third-party
       → @api/*  → @db/*     → drizzle/planetscale
                 → @vendor/*
```

### Version Strategy
- **React**: Forced to 19.2.1 via pnpm overrides
- **Next.js**: 15.5.7 for most apps, 16.1.6 for www
- **TypeScript**: 5.8.2+ across all packages
- **Tailwind**: v4.1.11 via catalog

---

## Considerations for Upgrade/Reset

### For Full Dependency Upgrade

**High-Risk Updates** (breaking changes likely):
1. **Next.js 15→16**: www already on 16, others need migration
2. **React 19**: Already on latest (19.2.1)
3. **tRPC 11→12**: Major API changes if upgrading
4. **Drizzle ORM**: Check migration guide
5. **Clerk**: Authentication breaking changes

**Catalog Updates Required**:
- Update all `catalog:` entries in `pnpm-workspace.yaml`
- Update root `pnpm.overrides` for React types

**Testing Strategy**:
1. Build all apps after upgrade
2. Run type checks
3. Test tRPC endpoints
4. Verify Clerk auth flows

### For apps/www Reset to Blank TanStack Project

**Current State**:
- Next.js 16.1.6 with App Router
- 51+ components, 30+ pages
- No TanStack Query (static site)
- BaseHub CMS integration
- Framer Motion, WebGL effects

**Reset Requirements**:
1. Preserve or migrate `env.ts` configuration
2. Preserve `@vendor/*` integrations if needed
3. Add TanStack Query if required
4. Set up new routing structure
5. Decide on CMS strategy (keep BaseHub or replace)

**Files to Preserve** (consider):
- `src/env.ts` - Environment validation
- `src/middleware.ts` - Security headers
- `next.config.ts` - Microfrontends config
- `public/` - Static assets (if needed)

---

## Open Questions

1. **TanStack Router vs Next.js App Router**: Is the goal to use TanStack Router, or add TanStack Query to the existing Next.js app?

2. **CMS Strategy**: Should BaseHub CMS integration be preserved or replaced?

3. **Microfrontends**: Should www remain part of the microfrontends architecture?

4. **Component Library**: Should @repo/ui be used in the reset, or start fresh?

5. **Upgrade Scope**: Should all apps be upgraded simultaneously or incrementally?

---

## Related Research

- No existing research documents on dependency upgrades found in thoughts/shared/research/

---

## Historical Context (from thoughts/)

No relevant historical documents found for this research topic.
