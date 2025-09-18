# Streaming Reliability & Persistence – Working Notes

## Overview
This document tracks reliability risks in the chat streaming stack (Next.js route + Lightfast runtime) and the status of mitigation work. It is organized by the user-visible failure mode, associated backend mechanics, and outstanding tasks.

---

## Completed Mitigations
### M1. Assistant persistence surfaced to the UI
- **Problem**: `appendMessage` failures previously returned 200, so users saw a reply that vanished on refresh.
- **Fixes shipped**:
  - `core/lightfast/src/core/server/runtime.ts`: wraps persistence errors, emits SSE `error` parts with metadata, keeps the stream alive.
  - `apps/chat/.../chat-interface.tsx`: intercepts the payload, clears artifact stream state, rolls back optimistic assistant messages, and renders a banner instead of escalating to the global error boundary.
- **Still to consider**:
  - Retry/backoff in runtime and gate optimistic cache updates on confirmed persistence.
  - Flag the affected assistant message in the stream so the client can offer a one-click resend.
  - Detect and clean up partially created sessions/messages left by the failed write path.

### M2. Resume registration feedback
- **Problem**: `memory.createStream` failures were silent; resume requests later returned 204 with no explanation.
- **Fixes shipped**:
  - Runtime broadcasts an SSE `error` chunk with `phase: "resume"` metadata and clears the active stream.
  - Chat interface shows an inline warning rather than throwing to the boundary and now clears local `hasActiveStream` state plus session cache on failure.
- **Pending**: evaluate retry/backoff path and verify backend always wipes `activeStreamId` before new POST.

### M3. Structured sync errors
- **Problem**: Synchronous route errors were emitted as raw strings, so the client misclassified them.
- **Fixes shipped**:
  - `fetchRequestHandler` serializes `ApiError` objects into `ChatErrorType` payloads (status + user text).

### M4. Optimistic assistant rollback
- **Problem**: Optimistic assistant messages lingered when persistence failed.
- **Fixes shipped**:
  - Runtime includes the assistant `messageId` in persistence-error metadata.
  - Session-specific chat components remove the optimistic message from TanStack cache on error callbacks.

---

## Open Issues & Planned Work
1. **Artifact/data stream cleanup**
   - Reset `setDataStream([])` when a new POST starts and add a timeout fallback when no `data-finish` arrives.
2. **Quota reservation visibility**
   - Surface SSE warnings and add retries/reconciliation for `releaseQuotaReservation` failures.
3. **Telemetry & monitoring**
   - Track counts for persistence failures, resume failures, quota release issues, and provider aborts.

---

## Additional Backend Scenarios (Needs Design)
### Session lifecycle invariants
- Make `createSession`/`appendMessage` idempotent for retried requests.
- Reject early when an existing session belongs to a different `resourceId`.

### Streaming pipeline resilience
- Handle provider `abort` chunks by emitting user-facing SSE signals (retry prompt, etc.).
- Guard against duplicate `onFinish` execution by making persistence idempotent per message ID.

### Resume bookkeeping
- Clear previous `activeStreamId` on every POST before attempting `createStream`.
- Differentiate “no active stream” (204) from “resume setup failed” (explicit error) for observability.

### Quota reservation flow
- Add background jobs to release stale reservations after crashes/timeouts.
- Expose SSE warnings so users know limits might appear stricter until cleanup.

### Tool & artifact integration
- Ensure tool side effects are rolled back or compensated if persistence fails.
- For anonymous Redis memory, refresh TTL on every write to avoid mid-conversation eviction.

### Miscellaneous edge cases
- Partial session creation with no first message → detect and clean up or retry.
- Stream ID leakage after repeated failures → ensure TTL/cleanup.
- Model metadata drift when persistence fails → decide on server-side redaction/flagging.
- Message ID collisions on retry → enforce uniqueness or regenerate IDs.
- Align adapter behavior between Redis and PlanetScale so error semantics stay consistent.

---

## Summary Queue (High → Low)
1. Artifact/data-stream cleanup & timeout handling 🔜
2. Quota reservation observability & retries
3. Telemetry for streaming/persistence failure classes
4. Longer-term architecture items listed above

This list will evolve as we land fixes; update the “Completed Mitigations” section with links/notes once each task ships.

---

## Streaming-Focused Production Readiness Checklist (Future Work)
Once the current queue is resolved, additional streaming-specific hardening to reach production maturity:

- **Broader hardening**
  - Make message/session writes idempotent across retries and multi-region failover.
  - Guarantee transactional behavior for tool/artifact side-effects alongside streaming replies.
  - Add background reconciliation for partially persisted streams and orphaned sessions.

- **Availability planning**
  - Design circuit breakers/fallbacks when providers, queues, or memory stores degrade.
  - Test degradation scenarios (provider outages, slow storage, partial data center failures) via chaos drills.
  - Ensure graceful handling of deploy restarts / node crashes mid-stream.

- **Streaming-centric security & compliance**
  - Validate/seal all SSE payloads to prevent injection/tampering.
  - Enforce audit logs for stream start/stop, resume attempts, and tool invocations.
  - Harden rate limits/abuse detection specifically for long-lived streaming connections.

- **Observability & operations**
  - Define SLIs/SLOs for stream start latency, persistence success rate, and resume success rate.
  - Instrument end-to-end tracing across streaming lifecycle (session creation → persistence).
  - Provide runbooks for streaming-specific incidents (e.g., provider outage, storage saturation).

- **User experience safeguards**
  - Offer auto-resend/“save draft” flows when streams terminate unexpectedly.
  - Surface proactive degradation banners (e.g., “streaming degraded – responses may pause”).
  - Allow users to download raw streamed output when persistence is uncertain.
