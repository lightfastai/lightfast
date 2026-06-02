import { afterEach, describe, expect, it, vi } from "vitest";

import { runEnvSh } from "../cli";
import type { EmulatorManifest } from "../manifest";

const manifest: EmulatorManifest = {
  name: "test",
  port: 4599,
  originEnvVar: "TEST_EMULATOR_ORIGIN",
  env: (_appOrigin, emulatorOrigin) => ({
    TEST_API_ORIGIN: emulatorOrigin,
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
  it("emits shell assignments using --emulator-origin", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const argv = [
      ...process.argv.slice(0, 2),
      "--app-origin",
      "https://app.lightfast.localhost",
      "--emulator-origin",
      "https://test.lightfast.localhost",
    ];
    vi.spyOn(process, "argv", "get").mockReturnValue(argv);

    runEnvSh(manifest);

    expect(log).toHaveBeenCalledWith(
      "TEST_API_ORIGIN='https://test.lightfast.localhost'\nTEST_CLIENT_ID='test_client'"
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
