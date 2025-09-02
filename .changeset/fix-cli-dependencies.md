---
"@lightfastai/cli": patch
---

fix: restore React and UI dependencies to CLI package for npm publishing

Previously removed in PR #134, these dependencies are required when the CLI package is published to npm. The dev-server output references these packages but they weren't available in the published package, causing runtime errors.

Restored dependencies:
- React, React DOM, and related types
- TanStack Query and Router
- AI SDK packages
- UI component libraries (Radix UI, lucide-react, etc.)
- Build utilities (class-variance-authority, clsx, tailwind-merge)

This ensures the dev-server UI works correctly when the CLI is installed from npm.