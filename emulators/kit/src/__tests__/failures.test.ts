import type { ServicePlugin } from "@emulators/core";
import { afterEach, describe, expect, it } from "vitest";

import { bearerToken } from "../auth";
import { createFailures } from "../failures";
import { type StartedEmulator, startEmulator } from "../lifecycle";

const { getFailures, registerFailures, seedFailures } = createFailures([
  "alpha",
  "beta",
] as const);

const plugin: ServicePlugin = {
  name: "failures-fixture",
  register(app, store) {
    registerFailures(app, store);
    app.get("/state", (c) => c.json(getFailures(store)));
    app.get("/whoami", (c) => c.json({ token: bearerToken(c) ?? null }));
  },
  seed(store) {
    seedFailures(store);
  },
};

let emulator: StartedEmulator | undefined;

afterEach(async () => {
  await emulator?.close();
  emulator = undefined;
});

async function postFailures(url: string, body: unknown) {
  return fetch(`${url}/failures`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createFailures", () => {
  it("seeds every switch to false", async () => {
    emulator = await startEmulator(plugin, { port: 0 });
    const res = await fetch(`${emulator.url}/state`);
    expect(await res.json()).toEqual({ alpha: false, beta: false });
  });

  it("toggles only the named switch and leaves the rest", async () => {
    emulator = await startEmulator(plugin, { port: 0 });
    const res = await postFailures(emulator.url, { alpha: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      failures: { alpha: true, beta: false },
    });
  });

  it("rejects a non-boolean switch value", async () => {
    emulator = await startEmulator(plugin, { port: 0 });
    const res = await postFailures(emulator.url, { alpha: "nope" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalid_failure_switch",
      field: "alpha",
    });
  });

  it("rejects an array body", async () => {
    emulator = await startEmulator(plugin, { port: 0 });
    const res = await postFailures(emulator.url, [1, 2, 3]);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_failure_switches" });
  });

  it("/reset clears previously toggled switches", async () => {
    emulator = await startEmulator(plugin, { port: 0 });
    await postFailures(emulator.url, { alpha: true, beta: true });
    const res = await fetch(`${emulator.url}/reset`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      failures: { alpha: false, beta: false },
    });
  });
});

describe("bearerToken", () => {
  it("extracts the token from a Bearer authorization header", async () => {
    emulator = await startEmulator(plugin, { port: 0 });
    const res = await fetch(`${emulator.url}/whoami`, {
      headers: { authorization: "Bearer abc.123" },
    });
    expect(await res.json()).toEqual({ token: "abc.123" });
  });

  it("returns null when the header is missing or not a Bearer token", async () => {
    emulator = await startEmulator(plugin, { port: 0 });
    const res = await fetch(`${emulator.url}/whoami`, {
      headers: { authorization: "Basic abc" },
    });
    expect(await res.json()).toEqual({ token: null });
  });
});
