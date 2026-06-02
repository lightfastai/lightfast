import type { AppEnv, Hono, Store } from "@emulators/core";

const FAILURES_KEY = "failures";

export type FailureSwitches<K extends string> = Record<K, boolean>;

export interface FailureRegistry<K extends string> {
  defaultFailures(): FailureSwitches<K>;
  getFailures(store: Store): FailureSwitches<K>;
  registerFailures(app: Hono<AppEnv>, store: Store): void;
  seedFailures(store: Store): void;
}

/**
 * Build a failure-switch registry for a fixed set of boolean switches.
 *
 * Exposes the shared `/failures` (toggle) and `/reset` (clear) routes plus
 * seed/read helpers so each emulator only declares its switch names.
 */
export function createFailures<K extends string>(
  names: readonly K[]
): FailureRegistry<K> {
  function defaultFailures(): FailureSwitches<K> {
    return Object.fromEntries(
      names.map((name) => [name, false])
    ) as FailureSwitches<K>;
  }

  function getFailures(store: Store): FailureSwitches<K> {
    return store.getData<FailureSwitches<K>>(FAILURES_KEY) ?? defaultFailures();
  }

  function seedFailures(store: Store): void {
    store.setData(FAILURES_KEY, defaultFailures());
  }

  function registerFailures(app: Hono<AppEnv>, store: Store): void {
    app.post("/failures", async (c) => {
      const body = (await c.req.json().catch(() => null)) as Partial<
        Record<K, unknown>
      > | null;
      if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
        return c.json({ error: "invalid_failure_switches" }, 400);
      }

      const failures = getFailures(store);
      for (const name of names) {
        const value = body?.[name];
        if (value === undefined) {
          continue;
        }
        if (typeof value !== "boolean") {
          return c.json({ error: "invalid_failure_switch", field: name }, 400);
        }
        failures[name] = value;
      }
      store.setData(FAILURES_KEY, failures);
      return c.json({ failures }, 200);
    });

    app.post("/reset", (c) => {
      const failures = defaultFailures();
      store.setData(FAILURES_KEY, failures);
      return c.json({ failures }, 200);
    });
  }

  return { defaultFailures, getFailures, registerFailures, seedFailures };
}
