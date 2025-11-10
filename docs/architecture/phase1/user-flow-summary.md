---
title: User Onboarding Flow - Executive Summary
description: Key findings and recommendations from architecture investigation
status: proposed
owner: product
audience: all
last_updated: 2025-11-07
tags: [onboarding, summary]
---

# User Onboarding Flow - Executive Summary

Quick reference guide for the user onboarding architecture. See [user-flow-architecture.md](./user-flow-architecture.md) for complete details.

---

## Key Finding: No Database Migrations Needed! 🎉

**The existing schemas already support the recommended architecture.**

We can ship the complete onboarding flow using only the tables we have:
- `lightfast_deus_organizations` (MySQL)
- `lightfast_deus_connected_repository` (MySQL)
- `lf_stores` (Postgres)
- `lf_docs_documents` (Postgres)
- `lf_vector_entries` (Postgres)
- `lf_ingestion_commits` (Postgres)

---

## Recommended Architecture

### Core Concept: Organization = Workspace (Phase 1)

```
GitHub Organization (lightfastai)
        ↓ 1:1 mapping
Lightfast Organization (id: org_123)
        ↓ 1:1 implicit
Workspace (id: ws_lightfastai)
        ↓ 1:N
Stores (docs-site, api-docs, etc.)
```

**Benefits:**
- ✅ Zero configuration overhead
- ✅ Simple mental model
- ✅ Fast time to value (< 5 min)
- ✅ Easy Phase 2 migration path

---

## 5-Minute User Journey

```
1. Sign Up (30s)
   → Clerk authentication

2. Connect GitHub (30s)
   → OAuth flow, store token

3. Claim Organization (20s)
   → Select GitHub org, create/join Lightfast org

4. Connect Repositories (1m)
   → Select repos to enable

5. Configure (2m)
   → Setup wizard OR manual lightfast.yml

6. First Ingestion (1m)
   → Push to main → automatic indexing

7. Search Ready! ✨
```

---

## Entity Relationships

### Simplified View

```
User (Clerk)
  ↓ member of
Organization (Clerk)  ──links to──>  Organization (Lightfast)
  ↓ owns                                    ↓ has many
Repository (GitHub)  ──connects to──>  ConnectedRepository
  ↓ contains                                ↓ defines
lightfast.yml  ────configures───>  Store (in workspace)
  ↓ indexes
Documents → Vectors (Pinecone)
```

### Key Identifiers

| Entity | Primary Key | Immutable ID | Mutable Fields |
|--------|------------|--------------|----------------|
| Organization | `id` (uuid) | `githubOrgId` | `githubOrgSlug`, `clerkOrgSlug` |
| Repository | `id` (uuid) | `githubRepoId` | `metadata.fullName` |
| Workspace | - | `ws_${githubOrgSlug}` | - (computed) |
| Store | `id` (uuid) | `(workspaceId, name)` | - |

---

## lightfast.yml Resolution

### Phase 1: Implicit (Recommended)

```yaml
# Minimal config - workspace auto-resolved
version: 1
store: docs-site
include:
  - docs/**/*.md
  - apps/docs/content/**/*.mdx
```

**Resolution Logic:**
```typescript
// 1. Webhook receives push
// 2. Look up repository → organization
// 3. Compute workspace: ws_${org.githubOrgSlug}
// 4. Use workspace for store creation
const workspaceId = `ws_${organization.githubOrgSlug}`;
```

### Phase 2: Explicit (Future)

```yaml
# Explicit workspace for multi-workspace orgs
version: 1
workspace: engineering
store: docs-site
include:
  - docs/**/*.md
```

---

## Implementation Plan

### Missing Components

1. **Repository Connection UI** (`/org/[slug]/repositories/connect`)
   - Fetch repos from GitHub
   - Show checkboxes to select
   - Check for lightfast.yml
   - Create ConnectedRepository records

2. **Configuration Wizard** (`/org/[slug]/repositories/[id]/configure`)
   - Store name input
   - Glob pattern builder
   - File preview (count matching files)
   - Generate & commit lightfast.yml via PR

3. **Workspace Resolution** (in webhook handler)
   - Fetch lightfast.yml from repo
   - Resolve workspace from organization
   - Pass to Inngest workflow

4. **Store Management UI** (`/org/[slug]/stores`)
   - List stores in workspace
   - Search interface per store
   - Ingestion history

### Implementation Phases

| Phase | Duration | Focus |
|-------|----------|-------|
| 1.4 | Week 1 | Repository connection UI |
| 1.5 | Week 2 | Configuration wizard |
| 1.6 | Week 3 | Workspace resolution + ingestion |
| 1.7 | Week 4 | Store management UI |
| 1.8 | Week 5 | Polish + testing |

**Total:** 5 weeks to ship complete onboarding flow

---

## Multi-Tenant Architecture

### Isolation Layers

```
┌─────────────────────────────────────┐
│  Clerk Session                      │
│  - User → Org membership            │
│  - Role (admin/member)              │
└──────────────┬──────────────────────┘
               ↓
┌──────────────▼──────────────────────┐
│  Lightfast Organization             │
│  - WHERE clerkOrgId = ?             │
└──────────────┬──────────────────────┘
               ↓
┌──────────────▼──────────────────────┐
│  Workspace (implicit)               │
│  - ws_${githubOrgSlug}             │
└──────────────┬──────────────────────┘
               ↓
┌──────────────▼──────────────────────┐
│  Data Isolation                     │
│  - Stores: WHERE workspaceId = ?    │
│  - Pinecone: namespace = ws_*       │
└─────────────────────────────────────┘
```

### Team Scenarios

**New Organization:**
1. First user claims org → becomes admin
2. Creates Clerk organization automatically
3. Links Lightfast org to Clerk org

**Existing Organization:**
1. User tries to claim → detects existing
2. Verifies GitHub membership
3. Adds user to Clerk org with role
4. No data duplication

**Multiple Organizations:**
1. User can belong to multiple orgs
2. Clerk org switcher in UI
3. Each org has separate workspace
4. No cross-org data leakage

---

## Edge Cases Handled

### GitHub Issues

| Scenario | Detection | Resolution |
|----------|-----------|------------|
| App uninstalled | Webhook | Mark repos inactive, show reconnect |
| Permissions revoked | API 403 | Show permission request banner |
| Org renamed | Webhook | Update metadata.fullName only |
| Repo deleted | Webhook | Mark inactive, preserve data |
| Repo transferred | Webhook | Update metadata, keep in org |

### Config Issues

| Issue | Detection | Resolution |
|-------|-----------|------------|
| Missing lightfast.yml | 404 on fetch | Show setup wizard |
| Invalid YAML | Parse error | Show specific errors |
| Empty globs | Zero matches | Show warning, skip |
| Duplicate store | DB constraint | Suggest rename |

### Ingestion Failures

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Network timeout | Inngest timeout | Auto-retry 3x |
| Rate limit | GitHub 429 | Exponential backoff |
| Parse error | Markdown fail | Skip file, log |
| Embedding error | OpenAI fail | Retry with backoff |

---

## Success Metrics

### Onboarding Funnel Targets

```
Stage                    | Target
-------------------------|--------
Sign Up                  | 100%
GitHub Connect           | 95%
Org Claimed              | 90%
Repo Connected           | 85%
Config Added             | 70%
First Ingestion          | 65%
First Search             | 60%
```

### Time to Value

**Target:** < 5 minutes from sign up to first search

**Measurement:**
- Track timestamps at each stage
- Alert if > 10 minutes for 80th percentile
- Optimize slowest steps

### Quality Metrics

```
Metric                      | Target
----------------------------|--------
Webhook success rate        | > 99%
Ingestion error rate        | < 1%
Config validation success   | > 95%
User-reported issues        | < 5%
Organization activation     | > 80%
```

---

## Open Questions

### Phase 1 Decisions Needed

**Q1: Manual sync trigger?**
- **Recommendation:** Yes, add "Sync Now" button
- **Rationale:** Useful for testing and recovery

**Q2: Ingestion progress UI?**
- **Recommendation:** Polling-based status initially
- **Rationale:** Simple, no websockets needed
- **Phase 2:** Real-time updates

**Q3: Multiple lightfast.yml per repo?**
- **Recommendation:** No for Phase 1
- **Rationale:** Simplifies implementation, covers 95% of cases
- **Phase 2:** Consider monorepo patterns

**Q4: Config editing in UI vs GitHub?**
- **Recommendation:** GitHub as source of truth
- **Rationale:** Matches developer workflow
- **UI:** Show preview/diff, generate initial config only

### Future Enhancements

**Phase 2+:**
- Multiple workspaces per organization
- Advanced glob patterns (exclude, regex)
- Cross-store search
- Workspace-level permissions
- Integration with Linear, Notion, Slack

---

## Risk Assessment

### Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub rate limits | Medium | High | Queue + backoff |
| Config syntax errors | High | Medium | Validation wizard |
| Phase 2 migration | High | Low | Design migration now |

### Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| User confusion | Low | Medium | Clear UI copy + docs |
| Ingestion failures | Low | High | Retry logic + manual trigger |
| Performance issues | Low | Medium | Batch processing + caching |

---

## Next Steps

### Immediate Actions (This Week)

1. **Review & Approve:** Team reviews architecture document
2. **Create Issues:** Break down into GitHub issues for Phase 1.4-1.8
3. **Design Review:** UI/UX review for new screens
4. **Kickoff:** Start Phase 1.4 implementation

### Phase 1.4 Sprint (Week 1)

**Goal:** Ship repository connection flow

**Deliverables:**
- `/org/[slug]/repositories` page (list)
- `/org/[slug]/repositories/connect` page (selection)
- Check for lightfast.yml function
- Integration tests

**Definition of Done:**
- User can connect repos from UI
- Can see which repos have lightfast.yml
- All tests passing
- Deployed to staging

---

## Key Takeaways

1. **✅ No schema changes needed** - existing tables support everything
2. **✅ Simple model** - org = workspace for Phase 1
3. **✅ Fast to ship** - 5 weeks to complete onboarding
4. **✅ Easy to extend** - clear path to Phase 2 multi-workspace
5. **✅ Great DX** - < 5 minutes from repo to searchable docs

**Bottom Line:** We can ship a production-ready onboarding flow in 5 weeks using only the infrastructure we already have. The architecture is simple, scalable, and provides excellent user experience.

---

**For complete technical details, see:** [user-flow-architecture.md](./user-flow-architecture.md)
