import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import type {
  AppTanstackAuthRouteSmokeConfig,
  AppTanstackAuthSmokeSession,
  BuildAppTanstackAuthRouteSmokeConfigInput,
} from "./auth-route-smoke";
import {
  agentBrowser,
  agentEval,
  cleanupAppTanstackAuthSmokeSession,
  createAppTanstackAuthSmokeSession,
} from "./auth-route-smoke";
import { waitForRouteText } from "./automation-interaction-smoke";

export interface AppTanstackAutomationScheduleFixture {
  automationName: string;
  automationPrompt: string;
}

export interface AppTanstackAutomationSchedulePathsInput {
  automationId: string;
  orgSlug: string;
}

export interface AppTanstackAutomationSchedulePaths {
  detailPath: string;
}

export function buildAppTanstackAutomationScheduleFixture(
  input: { nowMs?: number } = {}
): AppTanstackAutomationScheduleFixture {
  const timestampMs = input.nowMs ?? Date.now();
  return {
    automationName: `Schedule smoke automation ${timestampMs}`,
    automationPrompt:
      "Verify the app-tanstack schedule and status editor smoke can mutate this automation.",
  };
}

export function buildAppTanstackAutomationSchedulePaths(
  input: AppTanstackAutomationSchedulePathsInput
): AppTanstackAutomationSchedulePaths {
  return {
    detailPath: `/${input.orgSlug}/automations/${input.automationId}`,
  };
}

async function createScheduleSmokeAutomation(input: {
  fixture: AppTanstackAutomationScheduleFixture;
  session: AppTanstackAuthSmokeSession;
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
    schedule: { kind: "daily", config: { time: "09:00" } },
    timezone: "UTC",
  });
}

async function clickMenuItemByText(
  config: AppTanstackAuthRouteSmokeConfig,
  text: string
) {
  await clickElementByExactText(config, {
    label: "menu item",
    selector: '[role="menuitem"]',
    text,
  });
}

async function clickButtonByName(
  config: AppTanstackAuthRouteSmokeConfig,
  name: string
) {
  await clickElementByExactText(config, {
    label: "button",
    selector: "button",
    text: name,
  });
}

async function clickElementByExactText(
  config: AppTanstackAuthRouteSmokeConfig,
  input: { label: string; selector: string; text: string }
) {
  const deadline = Date.now() + config.routeTimeoutMs;
  let latestText: string[] = [];

  while (Date.now() < deadline) {
    const raw = await agentEval(
      config,
      `(() => {
        const expected = ${JSON.stringify(input.text)};
        const elements = Array.from(document.querySelectorAll(${JSON.stringify(
          input.selector
        )}));
        const element = elements.find(
          (element) => element.textContent?.trim() === expected
        );
        if (!(element instanceof HTMLElement)) {
          return {
            clicked: false,
            text: elements.map((element) => element.textContent?.trim() ?? ""),
          };
        }
        element.scrollIntoView({ block: "center", inline: "center" });
        const pointerInit = {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0,
          buttons: 1,
          pointerType: "mouse",
          isPrimary: true,
        };
        const mouseInit = {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0,
          buttons: 1,
          view: window,
        };
        const PointerCtor = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
        element.dispatchEvent(new PointerCtor("pointerdown", pointerInit));
        element.dispatchEvent(new MouseEvent("mousedown", mouseInit));
        element.dispatchEvent(new PointerCtor("pointerup", {
          ...pointerInit,
          buttons: 0,
        }));
        element.dispatchEvent(new MouseEvent("mouseup", {
          ...mouseInit,
          buttons: 0,
        }));
        element.dispatchEvent(new MouseEvent("click", {
          ...mouseInit,
          buttons: 0,
        }));
        return { clicked: true };
      })()`
    );
    const result = JSON.parse(raw) as
      | { clicked: false; text: string[] }
      | { clicked: true };
    if (result.clicked) {
      return;
    }
    latestText = result.text;
    await delay(250);
  }

  throw new Error(
    `Could not click ${input.label} "${input.text}". Available text: ${JSON.stringify(
      latestText
    )}`
  );
}

async function fillTimeInput(
  config: AppTanstackAuthRouteSmokeConfig,
  time: string
) {
  const raw = await agentEval(
    config,
    `(() => {
      const time = ${JSON.stringify(time)};
      const input = document.querySelector('input[type="time"]');
      if (!(input instanceof HTMLInputElement)) {
        return {
          filled: false,
          inputs: Array.from(document.querySelectorAll("input")).map(
            (element) => ({ type: element.type, value: element.value })
          ),
        };
      }
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(input, time);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
      return { filled: true, value: input.value };
    })()`
  );
  const result = JSON.parse(raw) as
    | { filled: false; inputs: Array<{ type: string; value: string }> }
    | { filled: true; value: string };
  if (!result.filled) {
    throw new Error(
      `Could not fill time input. Inputs: ${JSON.stringify(result.inputs)}`
    );
  }
  if (result.value !== time) {
    throw new Error(`Time input value stayed at ${result.value}`);
  }
}

async function waitForAutomationState(input: {
  automationPublicId: string;
  config: AppTanstackAuthRouteSmokeConfig;
  orgId: string;
  predicate: (automation: {
    scheduleConfig: unknown;
    scheduleKind: string;
    status: string;
    timezone: string;
  }) => boolean;
  reason: string;
}) {
  const [{ db }, { getAutomationByPublicId }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  const deadline = Date.now() + input.config.routeTimeoutMs;
  let latest:
    | {
        scheduleConfig: unknown;
        scheduleKind: string;
        status: string;
        timezone: string;
      }
    | undefined;

  while (Date.now() < deadline) {
    const automation = await getAutomationByPublicId(db, {
      clerkOrgId: input.orgId,
      publicId: input.automationPublicId,
    });
    if (automation) {
      const current = {
        scheduleConfig: automation.scheduleConfig,
        scheduleKind: automation.scheduleKind,
        status: automation.status,
        timezone: automation.timezone,
      };
      latest = current;
      if (input.predicate(current)) {
        return current;
      }
    } else {
      latest = undefined;
    }
    await delay(500);
  }

  throw new Error(
    `Timed out waiting for ${input.reason}. Last automation state: ${JSON.stringify(
      latest
    )}`
  );
}

function isWeeklyFridayAfternoon(input: {
  scheduleConfig: unknown;
  scheduleKind: string;
}) {
  if (input.scheduleKind !== "weekly") {
    return false;
  }
  const config = input.scheduleConfig;
  return (
    !!config &&
    typeof config === "object" &&
    "dayOfWeek" in config &&
    "time" in config &&
    config.dayOfWeek === 5 &&
    config.time === "14:30"
  );
}

export async function runAppTanstackAutomationScheduleSmoke(
  input: BuildAppTanstackAuthRouteSmokeConfigInput = {}
) {
  const nowMs = input.nowMs ?? Date.now();
  const fixture = buildAppTanstackAutomationScheduleFixture({ nowMs });
  let config: AppTanstackAuthRouteSmokeConfig | undefined;
  let session: AppTanstackAuthSmokeSession | undefined;

  try {
    session = await createAppTanstackAuthSmokeSession({
      ...input,
      nowMs,
    });
    config = session.config;
    const automation = await createScheduleSmokeAutomation({
      fixture,
      session,
    });
    const paths = buildAppTanstackAutomationSchedulePaths({
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
        "Active",
        "Daily at 9:00 AM",
        "Run now",
      ],
      name: "automation detail before schedule edit",
      path: paths.detailPath,
    });

    await clickButtonByName(config, "active");
    await clickMenuItemByText(config, "Paused");
    await waitForAutomationState({
      automationPublicId: automation.publicId,
      config,
      orgId: session.orgId,
      predicate: (row) => row.status === "paused",
      reason: "paused automation status",
    });
    await waitForRouteText(config, {
      expectedText: ["Paused"],
      name: "automation detail after pause",
      path: paths.detailPath,
    });

    await clickButtonByName(config, "paused");
    await clickMenuItemByText(config, "Active");
    await waitForAutomationState({
      automationPublicId: automation.publicId,
      config,
      orgId: session.orgId,
      predicate: (row) => row.status === "active",
      reason: "active automation status",
    });

    await clickButtonByName(config, "Daily at 9:00 AM");
    await clickButtonByName(config, "Daily");
    await clickMenuItemByText(config, "Weekly");
    await clickButtonByName(config, "Monday");
    await clickMenuItemByText(config, "Friday");
    await fillTimeInput(config, "14:30");
    await waitForAutomationState({
      automationPublicId: automation.publicId,
      config,
      orgId: session.orgId,
      predicate: isWeeklyFridayAfternoon,
      reason: "weekly Friday 14:30 schedule",
    });

    await agentBrowser(config, [
      "open",
      new URL(paths.detailPath, config.appOrigin).toString(),
    ]);
    await waitForRouteText(config, {
      expectedText: ["Active", "Weekly on Friday at 2:30 PM", "UTC"],
      name: "automation detail after schedule edit reload",
      path: paths.detailPath,
    });

    console.log(
      `[smoke] completed automation schedule edit ${automation.publicId}`
    );
  } finally {
    if (config) {
      await agentBrowser(config, ["close"]).catch(() => undefined);
    }
    if (session) {
      await cleanupAppTanstackAuthSmokeSession(session);
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
  runAppTanstackAutomationScheduleSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
