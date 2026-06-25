import { describe, expect, it } from "vitest";

import { createCliEnv } from "../env";

describe("CLI env", () => {
  it("parses optional CLI env vars", () => {
    expect(
      createCliEnv({
        LIGHTFAST_APP_URL: "https://app.lightfast.test",
        LIGHTFAST_CLI_CONFIG_DIR: "/tmp/lightfast-cli",
      })
    ).toMatchObject({
      LIGHTFAST_APP_URL: "https://app.lightfast.test",
      LIGHTFAST_CLI_CONFIG_DIR: "/tmp/lightfast-cli",
    });
  });

  it("rejects invalid app URLs", () => {
    expect(() => createCliEnv({ LIGHTFAST_APP_URL: "not-a-url" })).toThrow();
  });
});
