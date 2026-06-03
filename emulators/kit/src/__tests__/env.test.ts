import { describe, expect, it } from "vitest";

import { createEmulatorEnv } from "../env";
import type { EmulatorManifest } from "../manifest";

const manifest: EmulatorManifest = {
  name: "test",
  port: 4599,
  env: () => ({}),
  start: () =>
    Promise.resolve({
      close: () => Promise.resolve(),
      listenUrl: "http://127.0.0.1:4599",
      publicOrigin: "http://127.0.0.1:4599",
    }),
};

describe("createEmulatorEnv", () => {
  it("defaults only the server bind settings", () => {
    const env = createEmulatorEnv(manifest, {});
    expect(env.port).toBe(4599);
    expect(env.host).toBe("127.0.0.1");
    expect(env.callbackUrl).toBeUndefined();
    expect(env.publicOrigin).toBeUndefined();
  });

  it("reads generic callback URL and public origin", () => {
    const env = createEmulatorEnv(manifest, {
      CALLBACK_URL: "https://callback.example.test",
      PUBLIC_ORIGIN: "https://test.example.test",
    });
    expect(env.callbackUrl).toBe("https://callback.example.test");
    expect(env.publicOrigin).toBe("https://test.example.test");
  });

  it("allows any valid callback URL without app-specific assertions", () => {
    const env = createEmulatorEnv(manifest, {
      CALLBACK_URL: "http://localhost:4104",
    });
    expect(env.callbackUrl).toBe("http://localhost:4104");
  });

  it("coerces PORT and respects an explicit override", () => {
    const env = createEmulatorEnv(manifest, { PORT: "5005" });
    expect(env.port).toBe(5005);
  });
});
