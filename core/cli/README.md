# @lightfastai/cli

CLI for local testing and validation of Lightfast configuration.

## Purpose

Provides command-line tools for:
- Validating `lightfast.yml` configuration
- Testing search queries locally
- Manual ingestion (future)

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

Build the CLI:

```bash
pnpm --filter @lightfastai/cli build
```

## Usage

**Validate Config:**

```bash
lightfast validate [--config lightfast.yml]
```

Checks:
- Config file exists
- Valid YAML syntax
- Schema validation
- Workspace resolution
- Include globs match at least one file

**Test Search (Future):**

```bash
lightfast test-search "query" [--store docs-site]
```

Queries local Pinecone index for testing.

## Commands

### validate

Validates the `lightfast.yml` configuration file.

```bash
lightfast validate [options]

Options:
  --config <path>  Path to lightfast.yml (default: ./lightfast.yml)
  -h, --help       Display help
```

## Development

Run in development mode:

```bash
pnpm --filter @lightfastai/cli dev
```

## Documentation

For CLI specification, see [docs/architecture/phase1/package-structure.md](../../docs/architecture/phase1/package-structure.md).
