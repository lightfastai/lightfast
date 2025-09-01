---
"@lightfastai/dev-server": patch
---

Fix CLI React dependency errors with comprehensive bundling

The CLI v0.3.1 was still failing with "@tanstack/react-router" module not found errors despite the previous selective bundling fix. This changes the dev-server build to bundle ALL dependencies instead of selectively bundling specific packages.

Changes:
- Set `ssr.noExternal: true` in Vite config to bundle all dependencies
- SSR bundle grows from 262kB to 1.1MB but becomes completely self-contained  
- Dev-server output package.json now has empty dependencies: {}
- Eliminates all module resolution errors when CLI is installed via npx

This makes the dev-server truly self-contained for CLI distribution without needing any external dependencies at runtime.