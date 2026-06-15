import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type {
  AppAuthRouteSmokeConfig,
  AppAuthSmokeSession,
  BuildAppAuthRouteSmokeConfigInput,
} from "./auth-route-smoke";
import {
  agentBrowser,
  cleanupAppAuthSmokeSession,
  createAppAuthSmokeSession,
} from "./auth-route-smoke";
import {
  clickButtonByText,
  waitForRouteText,
} from "./automation-interaction-smoke";

export interface AppAutomationRunFixture {
  automationName: string;
  automationPrompt: string;
}

export interface AppAutomationRunPathsInput {
  automationId: string;
  orgSlug: string;
  runId?: string;
}

export interface AppAutomationRunPaths {
  detailPath: string;
  runDetailPath: string | null;
}

const OBSERVED_AUTOMATION_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;

type ObservedAutomationRunStatus =
  (typeof OBSERVED_AUTOMATION_RUN_STATUSES)[number];

interface AutomationRunRecord {
  errorCode: string | null;
  errorMessage: string | null;
  publicId: string;
  status: string;
  trigger: string;
}

export function buildAppAutomationRunFixture(
  input: { nowMs?: number } = {}
): AppAutomationRunFixture {
  const timestampMs = input.nowMs ?? Date.now();
  return {
    automationName: `Manual run smoke automation ${timestampMs}`,
    automationPrompt:
      "Verify the app manual run history smoke can enqueue this automation.",
  };
}

export function buildAppAutomationRunPaths(
  input: AppAutomationRunPathsInput
): AppAutomationRunPaths {
  const detailPath = `/${input.orgSlug}/automations/${input.automationId}`;
  return {
    detailPath,
    runDetailPath: input.runId
      ? `${detailPath}?run=${encodeURIComponent(input.runId)}`
      : null,
  };
}

export function isObservedAutomationRunStatus(
  value: string
): value is ObservedAutomationRunStatus {
  return OBSERVED_AUTOMATION_RUN_STATUSES.includes(
    value as ObservedAutomationRunStatus
  );
}

async function createManualRunSmokeAutomation(input: {
  fixture: AppAutomationRunFixture;
  session: AppAuthSmokeSession;
}) {
  const [{ db }, { createAutomation }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  return await createAutomation(db, {
    clerkOrgId: input.session.orgId,
    connectorProvider: null,
    createdByUserId: input.session.userId,
    name: input.fixture.automationName,
    prompt: input.fixture.automationPrompt,
    schedule: { kind: "manual", config: {} },
    timezone: "UTC",
  });
}

async function waitForManualRun(input: {
  automationPublicId: string;
  config: AppAuthRouteSmokeConfig;
  orgId: string;
}) {
  const [{ db }, { listAutomationRuns }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  const deadline = Date.now() + input.config.routeTimeoutMs;
  let latestRuns: AutomationRunRecord[] = [];

  while (Date.now() < deadline) {
    const runs = await listAutomationRuns(db, {
      automationPublicId: input.automationPublicId,
      clerkOrgId: input.orgId,
      limit: 5,
    });
    latestRuns = runs.map((run) => ({
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      publicId: run.publicId,
      status: run.status,
      trigger: run.trigger,
    }));
    const manualRun = latestRuns.find((run) => run.trigger === "manual");
    if (manualRun) {
      if (manualRun.errorCode === "AUTOMATION_RUN_ENQUEUE_FAILED") {
        throw new Error(
          [
            `Manual automation run ${manualRun.publicId} failed before enqueue.`,
            manualRun.errorMessage,
            "Start the local Inngest dev server or set a valid INNGEST_EVENT_KEY before running this smoke.",
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
      if (!isObservedAutomationRunStatus(manualRun.status)) {
        throw new Error(
          `Manual automation run ${manualRun.publicId} has unexpected status ${manualRun.status}.`
        );
      }
      return manualRun;
    }
    await delay(500);
  }

  throw new Error(
    `Timed out waiting for manual automation run. Latest runs: ${JSON.stringify(
      latestRuns
    )}`
  );
}

async function assertSelectedRunSearchParam(
  config: AppAuthRouteSmokeConfig,
  runId: string | null
) {
  const href = await agentBrowser(config, ["get", "url"]);
  const selectedRunId = new URL(href).searchParams.get("run");
  if (selectedRunId !== runId) {
    throw new Error(
      `Expected selected run query param ${runId ?? "<missing>"}, received ${selectedRunId ?? "<missing>"} at ${href}`
    );
  }
}

async function waitForSelectedRunSearchParam(
  config: AppAuthRouteSmokeConfig,
  runId: string | null
) {
  const deadline = Date.now() + config.routeTimeoutMs;
  let latestHref = "";

  while (Date.now() < deadline) {
    latestHref = await agentBrowser(config, ["get", "url"]);
    const selectedRunId = new URL(latestHref).searchParams.get("run");
    if (selectedRunId === runId) {
      return;
    }
    await delay(500);
  }

  throw new Error(
    `Timed out waiting for selected run query param ${runId ?? "<missing>"}. Last URL: ${latestHref}`
  );
}

export async function runAppAutomationRunSmoke(
  input: BuildAppAuthRouteSmokeConfigInput = {}
) {
  const nowMs = input.nowMs ?? Date.now();
  const fixture = buildAppAutomationRunFixture({ nowMs });
  let config: AppAuthRouteSmokeConfig | undefined;
  let session: AppAuthSmokeSession | undefined;

  try {
    session = await createAppAuthSmokeSession({
      ...input,
      nowMs,
    });
    config = session.config;
    const automation = await createManualRunSmokeAutomation({
      fixture,
      session,
    });
    const paths = buildAppAutomationRunPaths({
      automationId: automation.publicId,
      orgSlug: session.orgSlug,
    });

    console.log(`[smoke] app=${config.appOrigin}`);
    console.log(`[smoke] org=${session.orgSlug}`);
    console.log(`[smoke] automation=${automation.publicId}`);

    await agentBrowser(config, [
      "open",
      new URL(paths.detailPath, config.appOrigin).toString(),
    ]);
    await waitForRouteText(config, {
      expectedText: [
        fixture.automationName,
        fixture.automationPrompt,
        "Run now",
        "Previous runs",
        "No runs yet.",
      ],
      name: "automation detail before manual run",
      path: paths.detailPath,
    });

    await clickButtonByText(config, "Run now");
    const run = await waitForManualRun({
      automationPublicId: automation.publicId,
      config,
      orgId: session.orgId,
    });

    await waitForRouteText(config, {
      expectedText: ["Previous runs", "manual"],
      name: "automation detail after manual run",
      path: paths.detailPath,
    });

    const runPaths = buildAppAutomationRunPaths({
      automationId: automation.publicId,
      orgSlug: session.orgSlug,
      runId: run.publicId,
    });
    if (!runPaths.runDetailPath) {
      throw new Error("Run detail path was not built.");
    }

    await agentBrowser(config, [
      "open",
      new URL(runPaths.runDetailPath, config.appOrigin).toString(),
    ]);
    await assertSelectedRunSearchParam(config, run.publicId);
    await waitForRouteText(config, {
      expectedText: ["manual run", "Status", "Trigger", "Run ID", run.publicId],
      name: "automation manual run detail",
      path: runPaths.detailPath,
    });

    const invalidRunPaths = buildAppAutomationRunPaths({
      automationId: automation.publicId,
      orgSlug: session.orgSlug,
      runId: "automation_run_00000000-0000-4000-8000-000000000000",
    });
    if (!invalidRunPaths.runDetailPath) {
      throw new Error("Invalid run detail path was not built.");
    }

    await agentBrowser(config, [
      "open",
      new URL(invalidRunPaths.runDetailPath, config.appOrigin).toString(),
    ]);
    await waitForSelectedRunSearchParam(config, null);
    await waitForRouteText(config, {
      expectedText: ["Previous runs", "manual"],
      name: "automation invalid selected run recovery",
      path: invalidRunPaths.detailPath,
    });

    console.log(`[smoke] completed automation manual run ${run.publicId}`);
  } finally {
    if (config) {
      await agentBrowser(config, ["close"]).catch(() => undefined);
    }
    if (session) {
      await cleanupAppAuthSmokeSession(session);
    }
  }
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return Boolean(
    entrypoint && path.resolve(entrypoint) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  runAppAutomationRunSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
