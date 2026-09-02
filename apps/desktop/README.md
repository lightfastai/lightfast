# Lightfast Desktop

A local-only Electron shell for repository development. It renders bundled
static files with context isolation, sandboxing, Node integration disabled,
and all renderer network connections blocked by Content Security Policy.

It has no backend, authentication, local database, telemetry, updates,
packaging, signing, release workflow, E2E harness, or production wiring.

From the repository root:

```bash
pnpm --filter @lightfast/desktop dev
```

The command builds the static shell and launches Electron. It does not use a
Portless route because it is not a browser service.
