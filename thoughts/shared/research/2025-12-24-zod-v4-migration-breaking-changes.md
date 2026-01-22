---
date: 2025-12-24T00:30:12Z
researcher: Claude
git_commit: 7304237b82c79b11b1dc21662320cc3005a6951d
branch: main
repository: lightfast
topic: "Zod v4 Migration Breaking Changes Analysis"
tags: [research, codebase, zod, migration, breaking-changes, tRPC, drizzle-zod, react-hook-form]
status: complete
last_updated: 2025-12-24
last_updated_by: Claude
---

# Research: Zod v4 Migration Breaking Changes Analysis

**Date**: 2025-12-24T00:30:12Z
**Researcher**: Claude
**Git Commit**: 7304237b82c79b11b1dc21662320cc3005a6951d
**Branch**: main
**Repository**: lightfast

## Research Question

Understand Zod v4 breaking changes and assess migration impact for the Lightfast codebase.

## Summary

**CRITICAL BLOCKER**: The codebase cannot migrate to Zod v4 yet due to **drizzle-zod lacking v4 support**. The codebase uses drizzle-zod extensively in 9 database table files for schema generation. Additionally, MCP SDK is incompatible with Zod v4.

**Current State**: Zod `^3.24.0` (workspace catalog), with 136+ files using Zod across tRPC routers (26), react-hook-form integrations (24), environment validation (32), and drizzle-zod schemas (9).

**Recommendation**: Wait for drizzle-zod v4 support before migrating. Monitor [GitHub Issue #4625](https://github.com/drizzle-team/drizzle-orm/issues/4625).

---

## Detailed Findings

### 1. Current Codebase Zod Usage

#### Version Configuration
- **Workspace catalog**: `zod: ^3.24.0` (in `pnpm-workspace.yaml`)
- **Individual packages**: Some use `^3.25.76` directly
- **drizzle-zod**: `^0.7.1`

#### Usage Statistics

| Category | File Count |
|----------|------------|
| Total files importing Zod | 136+ |
| tRPC router files | 26 |
| react-hook-form integrations | 24 |
| Environment validation (env.ts) | 32 |
| drizzle-zod database schemas | 9 |
| Schema definition files | 50+ |
| API type definition files | 8 |

#### Key Directories

| Directory | Purpose |
|-----------|---------|
| `packages/console-validation/src/schemas/` | Business logic schemas (15 files) |
| `packages/console-types/src/api/` | Public API contracts (8 files) |
| `api/console/src/router/` | tRPC routers - console (17 files) |
| `api/chat/src/router/` | tRPC routers - chat (12 files) |
| `db/chat/src/schema/tables/` | drizzle-zod schemas (9 files) |
| `vendor/*/env.ts` | Vendor service env validation (16 files) |

---

### 2. Zod v4 Breaking Changes Affecting This Codebase

#### 2.1 Error Customization (HIGH IMPACT)

**Files affected**: All 50+ schema files using `.min()`, `.max()`, etc.

```typescript
// v3 - Current pattern in codebase
z.string().min(5, { message: "Too short" })

// v4 - Required change
z.string().min(5, { error: "Too short" })
```

**Also affected**:
- `required_error` and `invalid_type_error` params → replaced by `error` function
- Error map precedence changed

#### 2.2 ZodError Changes (MEDIUM IMPACT)

**Files affected**: `api/console/src/trpc.ts`, `api/chat/src/trpc.ts`, `api/console/src/lib/jobs.ts`

```typescript
// v3 - Current pattern
error.format()  // deprecated
error.flatten() // deprecated
error.errors    // removed

// v4 - Required change
error.issues    // use directly
z.prettifyError(error) // for formatted output
```

#### 2.3 String Format Validators (HIGH IMPACT)

**Files affected**: All env.ts files, API schema files

```typescript
// v3 - Current pattern
z.string().email()
z.string().uuid()
z.string().url()

// v4 - Required change
z.email()
z.uuid()
z.url()
```

#### 2.4 Object Schema Changes (MEDIUM IMPACT)

**Files affected**: Schema transformation patterns using `.merge()`

```typescript
// v3 - Current pattern
const fooBar = foo.merge(bar)

// v4 - Required change
const fooBar = z.object({ ...foo.shape, ...bar.shape })
```

#### 2.5 Record Schema Changes (LOW IMPACT)

**Files affected**: `packages/console-validation/src/schemas/workflow-io.ts`, etc.

```typescript
// v3 - Current pattern
z.record(z.string())

// v4 - Required change (explicit key schema)
z.record(z.string(), z.string())
```

#### 2.6 Describe to Meta (LOW IMPACT)

```typescript
// v3 - Current pattern
z.string().describe("Description")

// v4 - Required change
z.string().meta({ description: "Description" })
```

#### 2.7 superRefine to check (LOW IMPACT)

```typescript
// v3 - Current pattern
z.string().superRefine((val, ctx) => { ... })

// v4 - Required change
z.string().check((val, ctx) => { ... })
```

---

### 3. Integration Compatibility Matrix

| Integration | Status | Notes |
|-------------|--------|-------|
| **drizzle-zod** | **BLOCKER** | No v4 support - [Issue #4625](https://github.com/drizzle-team/drizzle-orm/issues/4625) |
| **MCP SDK** | **BLOCKER** | Incompatible - [Issue #1429](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1429) |
| **tRPC** | Compatible | Update error formatters |
| **react-hook-form** | Partial | Use `@hookform/resolvers@5.2.1+` |
| **@t3-oss/env** | Compatible | Test thoroughly |
| **AI SDK (Vercel)** | Compatible | Use version-specific imports |

---

### 4. drizzle-zod Blocker Details

**Affected files** (`db/chat/src/schema/tables/`):
- `artifact.ts` - Chat artifacts
- `attachment.ts` - File attachments
- `message.ts` - Chat messages
- `message-feedback.ts` - Message ratings
- `quota-reservations.ts` - Usage quotas
- `session.ts` - Chat sessions
- `session-share.ts` - Shared sessions
- `stream.ts` - Streaming data
- `usage.ts` - Usage tracking

**Additional utility**:
- `vendor/db/src/utils/drizzle-zod.ts` - Custom drizzle-zod utilities

**Current usage pattern**:
```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const insertMessageSchema = createInsertSchema(messageTable);
export const selectMessageSchema = createSelectSchema(messageTable);
```

**Issue**: drizzle-zod v0.7.1 requires Zod v3.25.1+ and has no v4 support.

---

### 5. tRPC Error Handling Changes

**Files requiring updates**:
- `api/console/src/trpc.ts`
- `api/chat/src/trpc.ts`

**Current pattern**:
```typescript
errorFormatter(opts) {
  const { shape, error } = opts;
  return {
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof z.ZodError
        ? error.cause.flatten()  // DEPRECATED in v4
        : null,
    },
  };
}
```

**v4 migration**:
```typescript
errorFormatter(opts) {
  const { shape, error } = opts;
  return {
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof z.ZodError
        ? error.cause.issues  // Use .issues directly
        : null,
    },
  };
}
```

---

### 6. Migration Strategy (When Ready)

#### Incremental Migration via Subpath Versioning

Zod 3.25.0+ enables gradual migration:

```typescript
// Existing code continues to work
import { z } from "zod"        // v3
import { z } from "zod/v3"     // explicit v3

// New code can use v4
import { z } from "zod/v4"     // explicit v4
```

#### Recommended Order

1. **Wait** for drizzle-zod v4 support
2. **Prepare** by auditing all breaking change patterns
3. **Test** in isolated branch with subpath versioning
4. **Migrate** non-drizzle schemas first using `zod/v4`
5. **Update** drizzle-zod when support arrives
6. **Finalize** by removing v3 imports

#### Automated Tools

- [Hypermod Zod v4 Codemod](https://hypermod.io/explore/zod-v4)
- [zod-v3-to-v4 Codemod](https://github.com/nicoespeon/zod-v3-to-v4)

```bash
npx @hypermod/cli --transform zod-v4
# or
npx zod-v3-to-v4
```

---

## Code References

### Schema Definitions
- `packages/console-validation/src/schemas/` - 15 business logic schemas
- `packages/console-types/src/api/` - 8 API contract schemas
- `packages/console-validation/src/primitives/` - ID, name, slug validators

### tRPC Error Handling
- `api/console/src/trpc.ts` - Console API tRPC setup
- `api/chat/src/trpc.ts` - Chat API tRPC setup

### drizzle-zod Usage
- `db/chat/src/schema/tables/` - 9 table schemas
- `vendor/db/src/utils/drizzle-zod.ts` - Custom utilities

### Form Validation
- `apps/console/src/app/(app)/(user)/new/_components/workspace-form-provider.tsx`
- `apps/www/src/components/early-access-form-provider.tsx`

### Environment Validation
- `vendor/*/env.ts` - 16 vendor env files
- `apps/*/src/env.ts` - 5 app env files
- `api/*/src/env.ts` - 2 API env files

---

## Zod v4 Benefits (When Migrated)

### Performance
- 14x faster string parsing
- 7x faster array parsing
- 6.5x faster object parsing

### Bundle Size
- Core bundle: 2x smaller (5.36kb vs 12.47kb)
- Zod Mini: 85% reduction (1.88kb gzipped)

### TypeScript
- 100x reduction in `tsc` instantiations
- Fixes `.extend()` and `.omit()` chaining issues

### New Features
- JSON Schema conversion: `JSONSchema()` and `fromJSONSchema()`
- Metadata system: `.meta()` with registries
- Template literal types
- File schemas
- Internationalization support

---

## Related Resources

### Official Documentation
- [Zod v4 Migration Guide](https://zod.dev/v4/changelog)
- [Zod v4 Release Notes](https://zod.dev/v4)
- [Error Customization](https://v4.zod.dev/error-customization)

### Ecosystem Issues to Monitor
- [drizzle-zod v4 Support](https://github.com/drizzle-team/drizzle-orm/issues/4625)
- [MCP SDK Compatibility](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1429)
- [react-hook-form Issues](https://github.com/react-hook-form/react-hook-form/issues/12816)

---

## Open Questions

1. When will drizzle-zod support Zod v4? (Monitor Issue #4625)
2. Does any code use MCP SDK that would be affected?
3. Are there custom Zod utilities that depend on internal APIs (`_parse`, `_def`)?

---

## Conclusion

**Do not migrate to Zod v4 at this time.** The drizzle-zod dependency is a hard blocker. When drizzle-zod adds v4 support, use the incremental migration strategy with subpath versioning to minimize risk.
