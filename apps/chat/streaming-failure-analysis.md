# Streaming & Persistence Failure Modes

This document captures the current risks identified in the `c010` chat route, the shared streaming runtime, and the chat UI.

## 1. Assistant persistence failures are silent
- Location: `core/lightfast/src/core/server/runtime.ts` (`streamChat` `onFinish` handler) and route `onError` hook.
- When `memory.appendMessage` fails, the stream has already flushed to the client. We log and call `onError`, but the HTTP status remains 200.
- The client classifies the response as a success; on refresh, the assistant message disappears because it never hit the DB.
- Mitigation ideas:
  - Emit a terminal SSE control part (e.g., `data-error`) so the client can mark the run failed.
  - Flip the response into an HTTP error when persistence fails (buffer until success), or retry writes.

## 2. Resume bookkeeping can break without user feedback
- Location: `streamChat` `consumeSseStream` block (`memory.createStream`).
- If the resumable stream registration throws, we swallow unless `failOnStreamError` is opted in. The stream keeps flowing, but future `/GET` resume calls return 204.
- UI receives no signal; refresh results in an empty conversation.
- Mitigation ideas:
  - Fail fast when resumable registration fails, or send an explicit resume-error event that the transport surfaces to the UI.

## 3. Memory errors lose semantic error typing
- Synchronous message/session errors become `MessageOperationError` / `SessionCreationError` via `toMemoryApiError` and are serialized by `fetchRequestHandler` without the `type` metadata expected by `ChatErrorHandler`.
- The client treats them as “non-critical” and just logs, rather than showing the appropriate banner or rolling back optimistic UI state.
- Mitigation ideas:
  - Map memory errors to the structured `ApiErrors` helpers or otherwise include `type` in the serialized JSON.

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
These issues should inform both runtime hardening (stronger guardrails, retries, richer SSE control channel) and client UX (handling mid-stream failure states).
