import { describe, expect, it } from "vitest";

import { createGitHubEmulatorRuntimeEnv } from "../env";

describe("github emulator env", () => {
  it("defaults the local runtime env", () => {
    expect(createGitHubEmulatorRuntimeEnv({})).toEqual({
      appOrigin: "https://lightfast.localhost",
      emulatorOrigin: undefined,
      host: "127.0.0.1",
      port: 4567,
    });
  });

  it("prefers the explicit emulator origin over the Portless URL", () => {
    expect(
      createGitHubEmulatorRuntimeEnv({
        GITHUB_EMULATOR_ORIGIN: "https://github.lightfast.localhost",
        LIGHTFAST_APP_ORIGIN: "https://lightfast.localhost",
        PORT: "4736",
        PORTLESS_URL: "https://ignored.github.lightfast.localhost",
      })
    ).toEqual({
      appOrigin: "https://lightfast.localhost",
      emulatorOrigin: "https://github.lightfast.localhost",
      host: "127.0.0.1",
      port: 4736,
    });
  });

  it("falls back to the Portless URL for the public emulator origin", () => {
    expect(
      createGitHubEmulatorRuntimeEnv({
        HOST: "0.0.0.0",
        PORTLESS_URL: "https://feature.github.lightfast.localhost",
      })
    ).toEqual({
      appOrigin: "https://lightfast.localhost",
      emulatorOrigin: "https://feature.github.lightfast.localhost",
      host: "0.0.0.0",
      port: 4567,
    });
  });
});
