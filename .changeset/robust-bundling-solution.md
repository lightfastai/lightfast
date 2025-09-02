---
"@lightfastai/cli": major
"@lightfastai/dev-server": minor
---

feat: implement self-contained bundling for dev-server

Changed the bundling strategy to make the dev-server completely self-contained:
- Dev-server now bundles ALL dependencies with `noExternal: true` in Vite config
- CLI package no longer needs to maintain React/UI dependencies
- Eliminates manual tracking of transitive dependencies

This is a breaking change as the package structure changes significantly:
- Package size increases from ~240KB to ~1.1MB (includes bundled UI)
- Dev-server output is now 2.67MB (was ~600KB) with all deps bundled
- No more dependency version conflicts between packages

Benefits:
- More robust: Adding deps to dev-server doesn't require CLI updates
- Simpler maintenance: No manual dependency synchronization
- Better isolation: Dev-server deps don't leak to user's project