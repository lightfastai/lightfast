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
- **Still to consider**: retry/backoff in runtime and gating optimistic cache updates on confirmed persistence.

### M2. Resume registration feedback
- **Problem**: `memory.createStream` failures were silent; resume requests later returned 204 with no explanation.
- **Fixes shipped**:
  - Runtime broadcasts an SSE `error` chunk with `phase: "resume"` metadata and clears the active stream.
  - Chat interface shows an inline warning rather than throwing to the boundary.
- **Pending**: reset client `hasActiveStream` flag (next task) and evaluate retry/backoff path.

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
1. **Resume state sanity** *(next up)*
   - Ensure `useSessionState` clears `hasActiveStream` when the runtime reports a resume failure.
   - Confirm backend clears `activeStreamId` before starting a new POST regardless of later failures.
2. **Artifact/data stream cleanup**
   - Reset `setDataStream([])` when a new POST starts and add a timeout fallback when no `data-finish` arrives.
3. **Quota reservation visibility**
   - Surface SSE warnings and add retries/reconciliation for `releaseQuotaReservation` failures.
4. **Telemetry & monitoring**
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
1. Resume state accuracy in client + backend 🔜
2. Artifact/data-stream cleanup & timeout handling
3. Quota reservation observability & retries
4. Telemetry for streaming/persistence failure classes
5. Longer-term architecture items listed above

This list will evolve as we land fixes; update the “Completed Mitigations” section with links/notes once each task ships.
