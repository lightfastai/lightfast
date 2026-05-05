/**
 * `.batch([...])` polyfill for drivers that don't expose it natively.
 *
 * neon-http exposes `db.batch([...])` which runs queries in a single
 * atomic HTTP round-trip — Neon's substitute for transactions over HTTP.
 * drizzle-orm/postgres-js does not expose `.batch()` at all.
 *
 * This polyfill gives the local postgres-js driver a `.batch()` shim so
 * call sites that use `db.batch([...])` (today: only
 * api/app/src/router/org/org-api-keys.ts key rotation) still work in
 * local dev without branching on driver.
 *
 * IMPORTANT: this is `Promise.all`, NOT a real transaction. If revoke
 * succeeds and insert fails, you get a partial state. Acceptable for the
 * current consumer (key rotation is recoverable). If a future consumer
 * needs real atomicity in local dev, upgrade this to wrap
 * `database.transaction(async () => Promise.all(queries))` — postgres-js
 * supports real transactions.
 */
export function withBatchPolyfill<T extends object>(database: T) {
  return Object.assign(database, {
    batch: async (queries: readonly PromiseLike<unknown>[]) =>
      Promise.all(queries),
  });
}
