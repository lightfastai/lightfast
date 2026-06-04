#!/usr/bin/env bash
#
# Cloud-sandbox entrypoint for the full Lightfast dev stack.
# Keep root `pnpm dev` as the canonical local orchestration; this wrapper exists
# so Claude web and Codex cloud can point at one stable sandbox command while
# future Portless bind work stays scoped to scripts/cloud.

set -eu
(set -o pipefail) 2>/dev/null || true

ROOT="${CODEX_WORKTREE_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT"

exec pnpm dev "$@"
