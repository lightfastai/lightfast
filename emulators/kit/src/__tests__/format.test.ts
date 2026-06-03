import { describe, expect, it } from "vitest";

import { formatEnvString } from "../format";

describe("formatEnvString", () => {
  it("formats quoted env assignments for eval-free runtime injection", () => {
    expect(
      formatEnvString({
        GITHUB_APP_ID: "424242",
        GITHUB_APP_PRIVATE_KEY: "line1 line2\\nline3",
        GITHUB_APP_ENDPOINT_ORIGIN: "https://github.example.test",
      })
    ).toBe(
      [
        "GITHUB_APP_ID='424242'",
        "GITHUB_APP_PRIVATE_KEY='line1 line2\\nline3'",
        "GITHUB_APP_ENDPOINT_ORIGIN='https://github.example.test'",
      ].join("\n")
    );
  });

  it("rejects env assignments that cannot be safely passed through env -S", () => {
    expect(() =>
      formatEnvString({
        "GITHUB APP ID": "424242",
      })
    ).toThrow(/Invalid environment variable name/);

    expect(() =>
      formatEnvString({
        GITHUB_APP_PRIVATE_KEY: "line1\0line2",
      })
    ).toThrow(/contains a NUL byte/);
  });
});
