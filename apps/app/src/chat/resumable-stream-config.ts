/**
 * Resumable streams replay in-flight assistant generations across reloads and
 * reconnects. Keep this disabled in local development so chat does not depend
 * on Redis pub/sub while testing the TanStack app.
 */
export const isResumableStreamEnabled =
  (import.meta.env.VITE_VERCEL_ENV ?? "development") !== "development";
