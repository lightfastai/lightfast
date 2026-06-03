import { describe, expect, it } from "vitest";

import { createEmulatorEnv } from "../env";
import type { EmulatorManifest } from "../manifest";

const manifest: EmulatorManifest = {
  name: "test",
  port: 4599,
  originEnvVar: "TEST_EMULATOR_ORIGIN",
  env: () => ({}),
  start: () =>
    Promise.resolve({
      close: () => Promise.resolve(),
      listenUrl: "http://127.0.0.1:4599",
      publicOrigin: "http://127.0.0.1:4599",
    }),
};

describe("createEmulatorEnv", () => {
  it("defaults port to the manifest port and host to loopback", () => {
    const env = createEmulatorEnv(manifest, {});
    expect(env.port).toBe(4599);
    expect(env.host).toBe("127.0.0.1");
    expect(env.appOrigin).toBe("https://lightfast.localhost");
    expect(env.emulatorOrigin).toBeUndefined();
  });

  it("reads the manifest origin var and prefers it over PORTLESS_URL", () => {
    const env = createEmulatorEnv(manifest, {
      PORTLESS_URL: "https://fallback.lightfast.localhost",
      TEST_EMULATOR_ORIGIN: "https://test.lightfast.localhost",
    });
    expect(env.emulatorOrigin).toBe("https://test.lightfast.localhost");
  });

  it("falls back to PORTLESS_URL when the origin var is absent", () => {
    const env = createEmulatorEnv(manifest, {
      PORTLESS_URL: "https://fallback.lightfast.localhost",
    });
    expect(env.emulatorOrigin).toBe("https://fallback.lightfast.localhost");
  });

  it("coerces PORT and respects an explicit override", () => {
    const env = createEmulatorEnv(manifest, { PORT: "5005" });
    expect(env.port).toBe(5005);
  });
});
