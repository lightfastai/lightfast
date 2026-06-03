import { afterEach, describe, expect, it, vi } from "vitest";

import { runEnvSh } from "../cli";
import type { EmulatorManifest } from "../manifest";

const manifest: EmulatorManifest = {
  name: "test",
  port: 4599,
  env: ({ callbackUrl, publicOrigin }) => ({
    ...(callbackUrl ? { TEST_CALLBACK_URL: callbackUrl } : {}),
    TEST_API_ORIGIN: publicOrigin,
    TEST_CLIENT_ID: "test_client",
  }),
  start: () =>
    Promise.resolve({
      close: () => Promise.resolve(),
      listenUrl: "http://127.0.0.1:4599",
      publicOrigin: "http://127.0.0.1:4599",
    }),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runEnvSh", () => {
  it("emits shell assignments using generic callback URL and public origin", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const argv = [
      ...process.argv.slice(0, 2),
      "--callback-url",
      "https://callback.example.test",
      "--public-origin",
      "https://test.example.test",
    ];
    vi.spyOn(process, "argv", "get").mockReturnValue(argv);

    runEnvSh(manifest);

    expect(log).toHaveBeenCalledWith(
      "TEST_CALLBACK_URL='https://callback.example.test'\nTEST_API_ORIGIN='https://test.example.test'\nTEST_CLIENT_ID='test_client'"
    );
  });

  it("falls back to the manifest-port loopback origin when no flags are passed", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const baseArgv = process.argv.slice(0, 2);
    vi.spyOn(process, "argv", "get").mockReturnValue(baseArgv);

    runEnvSh(manifest);

    const emitted = log.mock.calls.at(0)?.at(0) as string;
    expect(emitted).toContain("TEST_API_ORIGIN='http://127.0.0.1:");
    expect(emitted).toContain("TEST_CLIENT_ID='test_client'");
  });
});
