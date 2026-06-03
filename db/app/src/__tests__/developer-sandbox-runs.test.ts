import { describe, expect, it } from "vitest";
import {
  createDeveloperSandboxCommandId,
  createDeveloperSandboxRunId,
  DEVELOPER_SANDBOX_COMMAND_ID_PREFIX,
  DEVELOPER_SANDBOX_RUN_ID_PREFIX,
  developerSandboxCommands,
  developerSandboxRuns,
} from "../schema";
import {
  createDeveloperSandboxCommand,
  createDeveloperSandboxRun,
  developerSandboxRunExpiresAt,
  finishDeveloperSandboxCommand,
  getDeveloperSandboxRunByPublicId,
  listExpiredDeveloperSandboxRuns,
  markDeveloperSandboxRunCleanupFailed,
  markDeveloperSandboxRunCredentialsLoaded,
  markDeveloperSandboxRunExpired,
  markDeveloperSandboxRunStopped,
} from "../utils/developer-sandbox-runs";

describe("developer sandbox run schema", () => {
  it("creates public ids with stable prefixes", () => {
    expect(createDeveloperSandboxRunId()).toMatch(
      /^developer_sandbox_run_[0-9a-f-]{36}$/,
    );
    expect(createDeveloperSandboxCommandId()).toMatch(
      /^developer_sandbox_command_[0-9a-f-]{36}$/,
    );
    expect(DEVELOPER_SANDBOX_RUN_ID_PREFIX).toBe("developer_sandbox_run_");
    expect(DEVELOPER_SANDBOX_COMMAND_ID_PREFIX).toBe(
      "developer_sandbox_command_",
    );
  });

  it("exports run fields required by the sandbox service", () => {
    expect(developerSandboxRuns.clerkOrgId.notNull).toBe(true);
    expect(developerSandboxRuns.actorUserId.notNull).toBe(true);
    expect(developerSandboxRuns.vercelSandboxId.notNull).toBe(true);
    expect(developerSandboxRuns.status.notNull).toBe(true);
    expect(developerSandboxRuns.credentialsLoadedAt.notNull).toBe(false);
    expect(developerSandboxRuns.expiresAt.notNull).toBe(true);
    expect(developerSandboxRuns.stoppedAt.notNull).toBe(false);
    expect(developerSandboxRuns.cleanupAttemptedAt.notNull).toBe(false);
    expect(developerSandboxRuns.cleanupFailureCode.notNull).toBe(false);
  });

  it("exports command metadata fields without raw output columns", () => {
    expect(developerSandboxCommands.sandboxRunId.notNull).toBe(true);
    expect(developerSandboxCommands.clerkOrgId.notNull).toBe(true);
    expect(developerSandboxCommands.actorUserId.notNull).toBe(true);
    expect(developerSandboxCommands.cmd.notNull).toBe(true);
    expect(developerSandboxCommands.args.notNull).toBe(true);
    expect(developerSandboxCommands.status.notNull).toBe(true);
    expect(developerSandboxCommands.policyDecision.notNull).toBe(true);
    expect(developerSandboxCommands.stdoutBytes.notNull).toBe(true);
    expect(developerSandboxCommands.stderrBytes.notNull).toBe(true);
    expect(developerSandboxCommands.redactionCount.notNull).toBe(true);
    expect("stdout" in developerSandboxCommands).toBe(false);
    expect("stderr" in developerSandboxCommands).toBe(false);
  });
});

describe("developer sandbox run helpers", () => {
  it("caps run expiry at 30 minutes and defaults to 10 minutes", () => {
    const now = new Date("2026-06-03T00:00:00.000Z");

    expect(developerSandboxRunExpiresAt(now).toISOString()).toBe(
      "2026-06-03T00:10:00.000Z",
    );
    expect(
      developerSandboxRunExpiresAt(now, 45 * 60 * 1000).toISOString(),
    ).toBe("2026-06-03T00:30:00.000Z");
  });

  it("exports helper functions used by services", () => {
    expect(typeof createDeveloperSandboxRun).toBe("function");
    expect(typeof getDeveloperSandboxRunByPublicId).toBe("function");
    expect(typeof markDeveloperSandboxRunCredentialsLoaded).toBe("function");
    expect(typeof markDeveloperSandboxRunStopped).toBe("function");
    expect(typeof markDeveloperSandboxRunExpired).toBe("function");
    expect(typeof markDeveloperSandboxRunCleanupFailed).toBe("function");
    expect(typeof listExpiredDeveloperSandboxRuns).toBe("function");
    expect(typeof createDeveloperSandboxCommand).toBe("function");
    expect(typeof finishDeveloperSandboxCommand).toBe("function");
  });
});
