---
date: 2026-03-19
topic: "Minor behavioral fixes for memory service port"
tags: [research, memory, behavioral-fixes, correlationId, holdForReplay]
status: complete
---

# Minor Behavioral Fixes

## Issue 1: Missing correlationId on Cancel Event
**Classification**: Correctness concern for tracing
**Fix**: Add `correlationId: z.string().max(128).optional()` to cancel input schema and forward to event data.
**File**: `api/memory/src/router/memory/backfill.ts:117-143`

## Issue 2: Entity Worker 401 Health-Check Signal Step Boundary
**Classification**: Port is CORRECT — actually an improvement
**Finding**: Original had a nested `step.sendEvent` inside `step.run` (invalid Inngest pattern). The port correctly extracts the signal to a top-level `step.sendEvent` outside the step closure.
**Fix**: None needed — current implementation is the correct version.

## Issue 3: Extra Connection Verification Gate on Trigger
**Classification**: Behavioral difference — additive, more restrictive
**Finding**: Original trigger route did NO pre-flight DB check. Port adds NOT_FOUND, active status, and tenant isolation checks.
**Fix**: Design choice. The extra gate is safe to keep — it's additive and catches errors earlier. Original trusted the upstream Gateway service; memory doesn't have that intermediary.

## Issue 4: Ingest-Delivery Fan-Out Ordering
**Classification**: Latency only, no correctness concern
**Finding**: Original used `Promise.all([inngest, realtime])` (parallel). Port uses sequential `step.sendEvent` then `step.run("publish-realtime")`.
**Fix**: Could convert to parallel if needed, but the ~50ms latency difference is negligible. Leave as-is.
