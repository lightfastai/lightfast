import type { AppEnv, Hono, Store } from "@emulators/core";

export interface FailureSwitches {
  accessTokenExpired: boolean;
  refresh: boolean;
  usersMe: boolean;
}

const failureSwitchNames = [
  "accessTokenExpired",
  "refresh",
  "usersMe",
] as const satisfies ReadonlyArray<keyof FailureSwitches>;

export function defaultFailures(): FailureSwitches {
  return { accessTokenExpired: false, refresh: false, usersMe: false };
}

export function getFailures(store: Store): FailureSwitches {
  return store.getData<FailureSwitches>("failures") ?? defaultFailures();
}

export function seedFailures(store: Store): void {
  store.setData("failures", defaultFailures());
}

export function registerFailures(app: Hono<AppEnv>, store: Store): void {
  app.post("/failures", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Partial<
      Record<keyof FailureSwitches, unknown>
    > | null;
    if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
      return c.json({ error: "invalid_failure_switches" }, 400);
    }

    const failures = getFailures(store);
    for (const name of failureSwitchNames) {
      const value = body?.[name];
      if (value === undefined) {
        continue;
      }
      if (typeof value !== "boolean") {
        return c.json({ error: "invalid_failure_switch", field: name }, 400);
      }
      failures[name] = value;
    }
    store.setData("failures", failures);
    return c.json({ failures }, 200);
  });

  app.post("/reset", (c) => {
    const failures = defaultFailures();
    store.setData("failures", failures);
    return c.json({ failures }, 200);
  });
}
