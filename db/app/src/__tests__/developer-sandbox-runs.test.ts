import { describe, expect, it } from "vitest";
import {
  createDeveloperSandboxCommandId,
  createDeveloperSandboxRunId,
  DEVELOPER_SANDBOX_COMMAND_ID_PREFIX,
  DEVELOPER_SANDBOX_RUN_ID_PREFIX,
  orgDeveloperSandboxCommands,
  orgDeveloperSandboxRuns,
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
      /^developer_sandbox_run_[0-9a-f-]{36}$/
    );
    expect(createDeveloperSandboxCommandId()).toMatch(
      /^developer_sandbox_command_[0-9a-f-]{36}$/
    );
    expect(DEVELOPER_SANDBOX_RUN_ID_PREFIX).toBe("developer_sandbox_run_");
    expect(DEVELOPER_SANDBOX_COMMAND_ID_PREFIX).toBe(
      "developer_sandbox_command_"
    );
  });

  it("exports run fields required by the sandbox service", () => {
    expect(orgDeveloperSandboxRuns.clerkOrgId.notNull).toBe(true);
    expect(orgDeveloperSandboxRuns.actorUserId.notNull).toBe(true);
    expect(orgDeveloperSandboxRuns.vercelSandboxId.notNull).toBe(true);
    expect(orgDeveloperSandboxRuns.status.notNull).toBe(true);
    expect(orgDeveloperSandboxRuns.credentialsLoadedAt.notNull).toBe(false);
    expect(orgDeveloperSandboxRuns.expiresAt.notNull).toBe(true);
    expect(orgDeveloperSandboxRuns.stoppedAt.notNull).toBe(false);
    expect(orgDeveloperSandboxRuns.cleanupAttemptedAt.notNull).toBe(false);
    expect(orgDeveloperSandboxRuns.cleanupFailureCode.notNull).toBe(false);
  });

  it("exports command metadata fields without raw output columns", () => {
    expect(orgDeveloperSandboxCommands.sandboxRunId.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.clerkOrgId.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.actorUserId.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.cmd.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.args.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.status.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.policyDecision.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.stdoutBytes.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.stderrBytes.notNull).toBe(true);
    expect(orgDeveloperSandboxCommands.redactionCount.notNull).toBe(true);
    expect("stdout" in orgDeveloperSandboxCommands).toBe(false);
    expect("stderr" in orgDeveloperSandboxCommands).toBe(false);
  });
});

describe("developer sandbox run helpers", () => {
  it("caps run expiry at 30 minutes and defaults to 10 minutes", () => {
    const now = new Date("2026-06-03T00:00:00.000Z");

    expect(developerSandboxRunExpiresAt(now).toISOString()).toBe(
      "2026-06-03T00:10:00.000Z"
    );
    expect(
      developerSandboxRunExpiresAt(now, 45 * 60 * 1000).toISOString()
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
