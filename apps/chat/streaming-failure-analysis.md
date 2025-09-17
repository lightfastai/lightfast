# Streaming & Persistence Failure Modes

This document captures the current risks identified in the `c010` chat route, the shared streaming runtime, and the chat UI.

## 1. Assistant persistence failures are silent ✅ mitigated (phase 1)
- Changes shipped in `core/lightfast/src/core/server/runtime.ts` now catch `appendMessage` errors, log them, and send a structured SSE `error` part to the client while keeping the stream alive.
- `apps/chat/src/app/(chat)/_components/chat-interface.tsx` listens for that `SERVER_ERROR` payload and shows an inline banner rather than silently succeeding.
- Still to do:
  - Retry/backoff on the server before giving up.
  - Preserve optimistic assistant message only when persistence confirms success.

## 2. Resume bookkeeping can break without user feedback ✅ mitigated (phase 1)
- Runtime now catches `memory.createStream` failures, clears the active stream, and ships a `resume`-scoped SSE `error` chunk so the UI warns the user that resume is unavailable.
- Inline banner informs the user; we avoid throwing to the boundary.
- Still to do:
  - Consider retry/backoff or queue-based resume registration.
  - Ensure `hasActiveStream` is reset in session state when resume fails.

## 3. Memory errors lose semantic error typing ✅ mitigated (phase 1)
- `core/lightfast/src/core/server/adapters/fetch.ts` now maps all errors to a typed payload (ChatErrorType + user-facing message) before returning.
- Client parser receives structured metadata, so classification works even when streaming never starts.
- Still to do:
  - Align JSON schema with `ApiErrors` helpers to avoid duplicating logic.

## 4. Artifact streaming can get stuck
- `useChatTransport` keeps appending SSE parts to the shared data stream, and `useArtifactStreaming` waits for a `data-finish` control part to flip `status` to `idle`.
- If the stream drops mid-flight, we never clear `currentArtifactRef` or hide the artifact.
- Users see a permanently “streaming” artifact with stale content.
- Mitigation ideas:
  - Reset `setDataStream([])` when a new POST begins.
  - Add timeout-based cleanup if no `data-finish` arrives within N seconds.

## 5. Quota release failures are invisible
- Route error hook asynchronously calls `releaseQuotaReservation`, logging failures but providing no client-facing signal.
- If release fails, quota remains locked even though the user saw the streamed answer.
- Mitigation ideas:
  - Surface a warning SSE control part when release fails, or add a retry/backoff loop with monitoring so we can detect stuck reservations.

---

## Next Steps (ordered)
1. **Artifact/stream cleanup**: reset `setDataStream([])` on new POST and add a timeout fallback to avoid stuck artifacts when no `data-finish` arrives.
2. **Optimistic updates** ✅ _done_: chat UI rolls back the optimistic assistant message when the backend reports a persistence failure and also clears the shared data stream.
3. **Resume state sanity**: ensure `hasActiveStream` and related flags clear when resume registration fails; consider retry/backoff.
4. **Quota release observability**: surface SSE warning or retry loop so users understand when reservations stick.
5. **Telemetry** (later): emit counters for persistence/resume failures to monitor regression.

---
These issues should inform both runtime hardening (stronger guardrails, retries, richer SSE control channel) and client UX (handling mid-stream failure states).

## Additional Memory Failure Edge Cases
- **Partial session creation**: if `memory.createSession` succeeds but a subsequent `appendMessage` fails, the session exists without the initiating message. We should detect and clean up orphaned sessions or re-attempt the write.
- **Stream ID leakage**: repeated `createStream` failures may leave stale entries in Redis/DB; consider TTLs or periodic cleanup to avoid resume pointing to dead streams.
- **Inconsistent model metadata**: persistence failure might prevent modelId/tool results from being stored. Client refresh would show a reply without metadata; decide whether to redact or mark such messages.
- **Message ID collisions**: optimistic message IDs generated client-side could collide if retries reuse the same IDs; ensure server rejects duplicates cleanly or clients regenerate IDs on retry.
- **Memory adapter divergence**: Redis (anon) and PlanetScale (auth) adapters differ in guarantees. Verify both surface failures uniformly so the SSE error channel produces consistent metadata.
