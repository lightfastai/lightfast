# Phase 1 Foundation Implementation

**Branch:** `feat/phase1-foundation`
**Status:** In Progress

## Scope

Implement core packages for Phase 1 docs ingestion and search pipeline.

### Packages in This Phase

1. **@db/console** - Database schemas and client
2. **@vendor/pinecone** - Pinecone vector client wrapper
3. **@repo/console-types** - Shared types and Zod schemas

## Implementation Order

1. Define Zod schemas in `@repo/console-types`
2. Implement Drizzle schemas in `@db/console`
3. Implement Pinecone client in `@vendor/pinecone`
4. Write tests for each package
5. Generate and apply database migrations

## Testing

Run tests for each package:
```bash
pnpm --filter @db/console test
pnpm --filter @vendor/pinecone test
pnpm --filter @repo/console-types test
```

## Architecture Reference

See `docs/architecture/phase1/package-structure.md` for complete specifications.

---

**Related Issue:** #285
