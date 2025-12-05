# @repo/console-config

Parse and validate `lightfast.yml` configuration files.

## Purpose

Provides utilities for:
- Loading and parsing `lightfast.yml` configuration
- Validating config structure with Zod schemas
- Matching files against glob patterns

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

```typescript
import { loadConfig, validateConfig, matchFiles } from "@repo/console-config";

// Load config from repo
const configResult = await loadConfig("/path/to/repo");

if (configResult.isOk()) {
  const config = configResult.value;

  // Match files against globs
  const files = await matchFiles("/path/to/repo", config.include);
}
```

## Config Schema

```yaml
version: 1
store: docs-site
include:
  - docs/**/*.md
  - docs/**/*.mdx
```

## Documentation

For config specification, see [docs/architecture/phase1/dx-configuration.md](../../docs/architecture/phase1/dx-configuration.md).
