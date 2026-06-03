import { env } from "~/env";

/**
 * Resumable streams replay an in-flight assistant generation across reloads and
 * reconnects by teeing it through Upstash Redis: the POST handler publishes the
 * SSE stream and the `[id]/stream` GET handler resumes it. This is shared by the
 * client (`useChat({ resume })`) and both server routes so the three stay in
 * lockstep.
 *
 * It is disabled in local development so the dev chat flow neither depends on
 * Redis pub/sub nor fires a reconnect GET on every mount. `NEXT_PUBLIC_VERCEL_ENV`
 * defaults to "development" at runtime, so this is true only on preview/production.
 */
export const isResumableStreamEnabled =
  env.NEXT_PUBLIC_VERCEL_ENV !== "development";
