/**
 * Global @sentry/core stub for integration tests.
 *
 * All three apps (connections, gateway, backfill) import sentry-init.ts at the
 * top of their app.ts, calling initAndBind() at module load time. This stub
 * provides no-op implementations so tests can import apps without error.
 */

/* eslint-disable @typescript-eslint/no-empty-function */

export class ServerRuntimeClient {}
export function initAndBind() {}
export function createTransport() {
  return { send: () => Promise.resolve({}), flush: () => Promise.resolve(true) };
}
export function withScope(cb: (scope: { setTag: (...args: unknown[]) => void }) => void) {
  cb({ setTag() {} });
}
export function captureException(_err: unknown) {}
export function captureMessage(_msg: string, _level?: string) {}
export function trpcMiddleware() {
  return async ({ next }: { next: () => Promise<unknown> }) => next();
}
