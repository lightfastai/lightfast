# Phase 1.6: Decouple GitHub from Organizations

**Status:** Planning
**Timeline:** 4 weeks
**Goal:** Make Lightfast organizations first-class citizens, with GitHub as an optional integration

---

## Problem

**Current Architecture (Phase 1-1.5):**
- Organizations ARE GitHub organizations (1:1 mapping)
- Users must "claim" GitHub installations to use Lightfast
- Workspace IDs computed from GitHub slugs
- Cannot use Lightfast without GitHub
- **13 identified bugs** stemming from tight coupling (Issue #289)

**Result:**
- Limited market (GitHub users only)
- Complex onboarding flow
- Race conditions and edge cases
- Inflexible for future integrations

---

## Solution

**New Architecture (Phase 1.6):**
- Organizations are native Lightfast entities
- GitHub is an **optional integration** (one of many)
- Standard create/join organization flow
- Stable workspace IDs (independent of GitHub)
- Opens path for Linear, Notion, Sentry, etc.

**Result:**
- Broader market reach
- Simpler onboarding flow
- **Eliminates all 13 bugs**
- Future-proof for multi-source platform

---

## Key Changes

### 1. Database Schema

**Organizations Table:**
```typescript
// BEFORE: GitHub fields required
{
  id: string;
  githubOrgId: number; // REQUIRED
  githubInstallationId: number; // REQUIRED
  githubOrgSlug: string; // REQUIRED
  clerkOrgId: string;
  clerkOrgSlug: string;
}

// AFTER: Native Lightfast org with optional GitHub
{
  id: string;
  name: string; // NEW
  slug: string; // NEW
  workspaceId: string; // NEW - stable, not GitHub-based
  clerkOrgId: string;
  clerkOrgSlug: string;
  githubOrgId?: number; // OPTIONAL
  githubInstallationId?: number; // OPTIONAL
  githubOrgSlug?: string; // OPTIONAL
  githubConnectedAt?: timestamp; // NEW
}
```

### 2. Onboarding Flow

**Before (Claiming):**
```
Sign Up → Connect GitHub → Claim Installation → Use Lightfast
```

**After (Standard):**
```
Sign Up → Create Organization → (Optional: Connect GitHub) → Use Lightfast
```

### 3. API Routes

**New Endpoints:**
- `POST /api/organizations/create` - Create native Lightfast org
- `POST /api/integrations/github/connect` - Connect GitHub to existing org

**Deprecated Endpoints:**
- ~~`POST /api/organizations/claim`~~ - Removed (replaced by create + connect)

### 4. Workspace Resolution

**Before:**
```typescript
// Computed from GitHub slug
const workspaceId = `ws_${githubOrgSlug}`;
```

**After:**
```typescript
// Stable, generated at org creation
const workspaceId = `ws_${nanoid(12)}`;
```

---

## Benefits

### Product
- ✅ **Broader market:** Not limited to GitHub users
- ✅ **Simpler UX:** Standard org creation (like Vercel, Clerk)
- ✅ **Flexible:** Easy to add more integrations

### Technical
- ✅ **Eliminates 13 bugs:** No more claiming race conditions
- ✅ **Stable IDs:** Workspace IDs never change
- ✅ **Clean separation:** Organizations ≠ Integrations
- ✅ **Backwards compatible:** Existing orgs work unchanged

### Business
- ✅ **Faster to market:** 12 weeks vs 16 weeks to fix bugs
- ✅ **Scalable:** Each new integration takes 1-2 weeks (vs 8-12)
- ✅ **Network effects:** More integrations = more value

---

## Migration Strategy

### Backwards Compatibility

**Existing orgs (GitHub-claimed):**
- Workspace IDs preserved: `ws_${githubOrgSlug}` (no data migration)
- All GitHub fields populated
- Marked as connected from creation
- **Zero downtime, zero data loss**

**New orgs (Phase 1.6):**
- Workspace IDs generated: `ws_${nanoid(12)}`
- GitHub optional, connected later
- Can be created without any integration

### Migration Steps

1. **Database migration** - Add native fields, make GitHub nullable
2. **Backfill existing orgs** - Populate name, slug, workspaceId
3. **Deploy new code** - New APIs, updated UI
4. **Remove deprecated code** - Claim endpoints and pages

**See:** `IMPLEMENTATION.md` for detailed migration plan.

---

## Timeline

**Total: 4 weeks**

- **Week 1:** Database schema + services layer
- **Week 2:** API routes + webhook updates
- **Week 3:** UI components + onboarding flow
- **Week 4:** Testing + deployment

**Compare:** Fixing 13 bugs individually = 16 weeks

---

## Success Metrics

### Functional
- [ ] New users can create orgs without GitHub
- [ ] Existing users' orgs continue working
- [ ] GitHub connection is optional
- [ ] All 13 bugs eliminated

### Performance
- [ ] Zero data loss during migration
- [ ] API response < 200ms
- [ ] UI loads < 1s

### Business
- [ ] Onboarding completion +30%
- [ ] GitHub connection rate > 70%
- [ ] Zero support tickets for claiming bugs

---

## Files

### Documentation
- **README.md** - This overview
- **IMPLEMENTATION.md** - Complete implementation plan with code examples

### Database
- `db/console/src/schema/tables/organizations.ts` - Updated schema
- `db/console/src/migrations/XXXXXX_phase1.6_decouple_github.sql` - Migration script

### API Routes
- `apps/console/src/app/api/organizations/create/route.ts` - Create org endpoint
- `apps/console/src/app/api/integrations/github/connect/route.ts` - Connect GitHub endpoint
- ~~`apps/console/src/app/(github)/api/organizations/claim/route.ts`~~ - Deleted

### UI Components
- `apps/console/src/app/(onboarding)/onboarding/create-org/page.tsx` - New create org page
- `apps/console/src/app/(app)/org/[slug]/settings/integrations/page.tsx` - Integrations settings
- ~~`apps/console/src/app/(onboarding)/onboarding/claim-org/page.tsx`~~ - Deleted

---

## Related Documentation

- **Strategic Analysis:** `../../STRATEGIC_ARCHITECTURE_ANALYSIS.md` - 3 pathways comparison
- **Bug Analysis:** `../../ONBOARDING_DB_CONNECTION_ANALYSIS.md` - 13 bugs to fix
- **Phase 1:** `../phase1/` - Original architecture
- **Phase 1.5:** `../phase1.5/` - Multi-source infrastructure
- **Phase 2:** `../phase2/` - Future integrations (Linear, Notion, etc.)

---

## Next Steps

1. **Review:** Team review of IMPLEMENTATION.md
2. **Approve:** Get approval for database migration
3. **Implement:** Follow 4-week timeline
4. **Deploy:** Staged rollout with monitoring
5. **Phase 2:** Add Linear, Notion, Sentry integrations (1-2 weeks each)

---

**Questions?** See `IMPLEMENTATION.md` for detailed technical specs.
