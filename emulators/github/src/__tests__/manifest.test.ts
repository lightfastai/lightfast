import { describe, expect, it } from "vitest";

import { GITHUB_EMULATOR_FIXTURES } from "../fixtures";
import { githubManifest } from "../manifest";

describe("githubManifest.env", () => {
  it("projects the GitHub App env from the emulator origin", () => {
    const env = githubManifest.env({
      callbackUrl: "https://callback.example.test",
      publicOrigin: "https://github.emulator.localhost",
    });
    expect(env.GITHUB_APP_ENDPOINT_ORIGIN).toBe(
      "https://github.emulator.localhost"
    );
    expect(env.GITHUB_APP_CLIENT_ID).toBe(
      GITHUB_EMULATOR_FIXTURES.oauthClientId
    );
    expect(env.GITHUB_APP_ID).toBe(
      String(GITHUB_EMULATOR_FIXTURES.githubAppId)
    );
    expect(env.GITHUB_APP_PRIVATE_KEY).toContain("\\n");
  });
});
