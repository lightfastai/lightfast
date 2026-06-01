import type { ServicePlugin } from "@emulators/core";
import { afterEach, describe, expect, it } from "vitest";

import { type StartedEmulator, startEmulator } from "../index";

const pingPlugin: ServicePlugin = {
  name: "ping",
  register(app, store) {
    app.get("/ping", (c) =>
      c.json({ ok: true, count: store.getData<number>("count") ?? 0 })
    );
  },
  seed(store) {
    store.setData("count", 1);
  },
};

let emulator: StartedEmulator | undefined;

afterEach(async () => {
  await emulator?.close();
  emulator = undefined;
});

describe("@repo/emulator-kit startEmulator", () => {
  it("boots a plugin, serves its routes, and reports a listen url", async () => {
    emulator = await startEmulator(pingPlugin, { port: 0 });
    expect(emulator.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const res = await fetch(`${emulator.url}/ping`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, count: 1 });
  });

  it("reset re-runs the plugin seed", async () => {
    emulator = await startEmulator(pingPlugin, { port: 0 });
    emulator.store.setData("count", 99);

    const before = await (await fetch(`${emulator.url}/ping`)).json();
    expect(before).toEqual({ ok: true, count: 99 });

    emulator.reset();
    const after = await (await fetch(`${emulator.url}/ping`)).json();
    expect(after).toEqual({ ok: true, count: 1 });
  });

  it("close stops the server", async () => {
    const local = await startEmulator(pingPlugin, { port: 0 });
    const { url } = local;
    await local.close();
    await expect(fetch(`${url}/ping`)).rejects.toThrow();
  });
});
