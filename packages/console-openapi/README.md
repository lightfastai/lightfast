# @repo/console-openapi

OpenAPI specification generator for the Lightfast Console API.

## Overview

This package generates OpenAPI 3.1 specifications from Zod schemas defined in `@repo/console-types`. It provides a clean separation between type definitions and API documentation.

## Usage

### Generate OpenAPI Spec

```bash
pnpm generate:openapi
```

This will generate `openapi.json` in the package root.

### Import in Other Packages

```typescript
// Import the registry and generator
import { registry, generateOpenAPIDocument } from "@repo/console-openapi";

// Import the generated JSON
import openapiSpec from "@repo/console-openapi/openapi.json";
```

## Architecture

```
@repo/console-types (Zod schemas)
         ↓
@repo/console-openapi (OpenAPI generation)
         ↓
    openapi.json
         ↓
@lightfast/docs (API documentation)
```

## Dependencies

- `@repo/console-types` - Zod schema definitions
- `@asteasolutions/zod-to-openapi` - OpenAPI generator
- `zod` - Schema validation

## Scripts

- `pnpm generate:openapi` - Generate OpenAPI specification
- `pnpm build` - Build TypeScript
- `pnpm dev` - Watch mode for development
