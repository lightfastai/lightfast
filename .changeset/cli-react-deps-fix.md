---
"@lightfastai/cli": patch
"@lightfastai/dev-server": patch
---

Fix CLI React dependency errors by bundling UI deps in dev-server

The CLI v0.3.0 was failing when installed via npx with "Cannot find package 'react'" errors. Instead of adding React dependencies to the CLI package (which would bloat it), we configure the dev-server build to bundle all UI dependencies.

- Configure Vite SSR to bundle React/UI deps instead of externalizing them  
- Keep CLI package.json clean with only core dependencies (5 vs 15+ deps)
- Self-contained dev-server output that works via npx
- Architecturally cleaner than polluting CLI deps with UI libraries