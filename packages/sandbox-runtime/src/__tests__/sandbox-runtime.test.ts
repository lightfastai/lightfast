import { beforeEach, describe, expect, it, vi } from "vitest";

const sandboxSdk = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@vendor/vercel-sandbox", () => ({
  Sandbox: sandboxSdk,
}));

const { createInMemorySandboxRuntimeForTests, createVercelSandboxRuntime } =
  await import("../index");

function createSdkCommand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    cmdId: "cmd_sdk_1",
    exitCode: 0,
    kill: vi.fn(async () => undefined),
    async *logs() {
      yield { stream: "stdout" as const, data: "hello\n" };
    },
    stderr: vi.fn(async () => ""),
    stdout: vi.fn(async () => "hello\n"),
    wait: vi.fn(async () => ({ exitCode: 0 })),
    ...overrides,
  };
}

function createSdkSandbox(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "sandbox_test",
    readFileToBuffer: vi.fn(async () => Buffer.from("file contents")),
    runCommand: vi.fn(async () => createSdkCommand()),
    status: "running",
    stop: vi.fn(async () => ({ status: "stopped" })),
    updateNetworkPolicy: vi.fn(async () => "deny-all"),
    writeFiles: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("@repo/sandbox-runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Vercel sandbox and normalizes command output", async () => {
    const sdk = createSdkSandbox();
    sandboxSdk.create.mockResolvedValue(sdk);

    const runtime = createVercelSandboxRuntime();
    const sandbox = await runtime.create({
      name: "developer-sandbox-run-1",
      runtime: "node24",
      timeoutMs: 300_000,
      resources: { vcpus: 2 },
      networkPolicy: "allow-all",
    });

    const command = await sandbox.exec({
      cmd: "node",
      args: ["--version"],
      env: { LIGHTFAST_SANDBOX_SMOKE: "1" },
      timeoutMs: 10_000,
    });

    await expect(command.stdout()).resolves.toBe("hello\n");
    await expect(command.stderr()).resolves.toBe("");
    await expect(command.wait()).resolves.toEqual({ exitCode: 0 });
    expect(sandboxSdk.create).toHaveBeenCalledWith({
      name: "developer-sandbox-run-1",
      runtime: "node24",
      timeout: 300_000,
      resources: { vcpus: 2 },
      networkPolicy: "allow-all",
      ports: undefined,
    });
    expect(sdk.runCommand).toHaveBeenCalledWith({
      cmd: "node",
      args: ["--version"],
      cwd: undefined,
      detached: false,
      env: { LIGHTFAST_SANDBOX_SMOKE: "1" },
      timeoutMs: 10_000,
    });
  });

  it("passes file and lifecycle operations through the Vercel sandbox", async () => {
    const sdk = createSdkSandbox();
    sandboxSdk.get.mockResolvedValue(sdk);

    const runtime = createVercelSandboxRuntime();
    const sandbox = await runtime.get("sandbox_test");

    await sandbox.writeFiles([
      { path: "/vercel/sandbox/test.txt", content: "contents", mode: 0o600 },
    ]);
    await expect(
      sandbox.readFileToBuffer("/vercel/sandbox/test.txt")
    ).resolves.toEqual(Buffer.from("file contents"));
    await sandbox.updateNetworkPolicy("deny-all");
    await sandbox.stop();

    expect(sandboxSdk.get).toHaveBeenCalledWith({
      name: "sandbox_test",
      sandboxId: "sandbox_test",
    });
    expect(sdk.writeFiles).toHaveBeenCalledWith([
      { path: "/vercel/sandbox/test.txt", content: "contents", mode: 0o600 },
    ]);
    expect(sdk.readFileToBuffer).toHaveBeenCalledWith({
      path: "/vercel/sandbox/test.txt",
    });
    expect(sdk.updateNetworkPolicy).toHaveBeenCalledWith("deny-all");
    expect(sdk.stop).toHaveBeenCalled();
  });

  it("provides an explicit in-memory runtime for tests only", async () => {
    const runtime = createInMemorySandboxRuntimeForTests();
    const sandbox = await runtime.create({ name: "test-run" });

    await sandbox.writeFiles([{ path: "/tmp/a.txt", content: "a" }]);
    const command = await sandbox.exec({
      cmd: "echo",
      args: ["hello"],
      env: { EXAMPLE: "1" },
    });

    await expect(command.stdout()).resolves.toBe("");
    await expect(command.stderr()).resolves.toBe("");
    await expect(command.wait()).resolves.toEqual({ exitCode: 0 });
    expect(runtime.calls).toMatchObject({
      create: [{ name: "test-run" }],
      exec: [{ cmd: "echo", args: ["hello"], env: { EXAMPLE: "1" } }],
      writeFiles: [[{ path: "/tmp/a.txt", content: "a" }]],
    });
  });
});
