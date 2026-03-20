# @repo/app-openapi

OpenAPI specification generator for the Lightfast Console API.

## Overview

This package generates OpenAPI 3.1 specifications from Zod schemas defined in `@repo/app-ai-types`. It provides a clean separation between type definitions and API documentation.

## Usage

### Generate OpenAPI Spec

```bash
pnpm generate:openapi
```

This will generate `openapi.json` in the package root.

### Import in Other Packages

```typescript
// Import the registry and generator
import { registry, generateOpenAPIDocument } from "@repo/app-openapi";

// Import the generated JSON
import openapiSpec from "@repo/app-openapi/openapi.json";
```

## Architecture

```
@repo/app-ai-types (Zod schemas)
         ↓
@repo/app-openapi (OpenAPI generation)
         ↓
    openapi.json
         ↓
@lightfast/docs (API documentation)
```

## Dependencies

- `@repo/app-ai-types` - Zod schema definitions
- `@asteasolutions/zod-to-openapi` - OpenAPI generator
- `zod` - Schema validation

## Scripts

- `pnpm generate:openapi` - Generate OpenAPI specification
- `pnpm build` - Build TypeScript
- `pnpm dev` - Watch mode for development
