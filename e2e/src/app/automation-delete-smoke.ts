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
  agentEval,
  cleanupAppAuthSmokeSession,
  createAppAuthSmokeSession,
} from "./auth-route-smoke";
import { waitForRouteText } from "./automation-interaction-smoke";

export interface AppAutomationDeleteFixture {
  automationName: string;
  automationPrompt: string;
}

export interface AppAutomationDeletePathsInput {
  automationId: string;
  orgSlug: string;
}

export interface AppAutomationDeletePaths {
  detailPath: string;
  listPath: string;
}

export function buildAppAutomationDeleteFixture(
  input: { nowMs?: number } = {}
): AppAutomationDeleteFixture {
  const timestampMs = input.nowMs ?? Date.now();
  return {
    automationName: `Delete smoke automation ${timestampMs}`,
    automationPrompt:
      "Verify the app automation delete smoke can remove this automation from the workspace list.",
  };
}

export function buildAppAutomationDeletePaths(
  input: AppAutomationDeletePathsInput
): AppAutomationDeletePaths {
  return {
    detailPath: `/${input.orgSlug}/automations/${input.automationId}`,
    listPath: `/${input.orgSlug}/automations`,
  };
}

async function createDeleteSmokeAutomation(input: {
  fixture: AppAutomationDeleteFixture;
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

async function clickButtonByExactText(
  config: AppAuthRouteSmokeConfig,
  input: { preferLast?: boolean; text: string }
) {
  const deadline = Date.now() + config.routeTimeoutMs;
  let latestButtons: string[] = [];

  while (Date.now() < deadline) {
    const raw = await agentEval(
      config,
      `(() => {
        const expected = ${JSON.stringify(input.text)};
        const buttons = Array.from(document.querySelectorAll("button"));
        const matches = buttons.filter(
          (element) =>
            element instanceof HTMLButtonElement &&
            element.textContent?.trim() === expected
        );
        const button = ${input.preferLast ? "matches.at(-1)" : "matches.at(0)"};
        if (!(button instanceof HTMLButtonElement)) {
          return {
            clicked: false,
            buttons: buttons.map((element) => element.textContent?.trim() ?? ""),
          };
        }
        if (button.disabled) {
          return {
            clicked: false,
            buttons: buttons.map((element) => element.textContent?.trim() ?? ""),
          };
        }
        button.scrollIntoView({ block: "center", inline: "center" });
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
        button.dispatchEvent(new PointerCtor("pointerdown", pointerInit));
        button.dispatchEvent(new MouseEvent("mousedown", mouseInit));
        button.dispatchEvent(new PointerCtor("pointerup", {
          ...pointerInit,
          buttons: 0,
        }));
        button.dispatchEvent(new MouseEvent("mouseup", {
          ...mouseInit,
          buttons: 0,
        }));
        button.dispatchEvent(new MouseEvent("click", {
          ...mouseInit,
          buttons: 0,
        }));
        return { clicked: true };
      })()`
    );
    const result = JSON.parse(raw) as
      | { buttons: string[]; clicked: false }
      | { clicked: true };
    if (result.clicked) {
      return;
    }
    latestButtons = result.buttons;
    await delay(250);
  }

  throw new Error(
    `Could not click "${input.text}" button. Buttons: ${JSON.stringify(
      latestButtons
    )}`
  );
}

async function waitForDeletedAutomation(input: {
  automationPublicId: string;
  config: AppAuthRouteSmokeConfig;
  orgId: string;
}) {
  const [{ db }, { getAutomationByPublicId }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  const deadline = Date.now() + input.config.routeTimeoutMs;
  let found = true;

  while (Date.now() < deadline) {
    const automation = await getAutomationByPublicId(db, {
      clerkOrgId: input.orgId,
      publicId: input.automationPublicId,
    });
    found = Boolean(automation);
    if (!found) {
      return;
    }
    await delay(500);
  }

  throw new Error(
    `Timed out waiting for deleted automation ${input.automationPublicId}. Found=${found}`
  );
}

export async function runAppAutomationDeleteSmoke(
  input: BuildAppAuthRouteSmokeConfigInput = {}
) {
  const nowMs = input.nowMs ?? Date.now();
  const fixture = buildAppAutomationDeleteFixture({ nowMs });
  let config: AppAuthRouteSmokeConfig | undefined;
  let session: AppAuthSmokeSession | undefined;

  try {
    session = await createAppAuthSmokeSession({
      ...input,
      nowMs,
    });
    config = session.config;
    const automation = await createDeleteSmokeAutomation({
      fixture,
      session,
    });
    const paths = buildAppAutomationDeletePaths({
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
        "Manual",
        "Delete",
      ],
      name: "automation detail before delete",
      path: paths.detailPath,
    });

    await clickButtonByExactText(config, { text: "Delete" });
    await waitForRouteText(config, {
      expectedText: ["Delete automation?", fixture.automationName],
      name: "automation delete confirmation",
      path: paths.detailPath,
    });
    await clickButtonByExactText(config, {
      preferLast: true,
      text: "Delete",
    });
    await waitForDeletedAutomation({
      automationPublicId: automation.publicId,
      config,
      orgId: session.orgId,
    });
    await waitForRouteText(config, {
      expectedText: ["Automations", "No automations yet"],
      name: "automation list after delete",
      path: paths.listPath,
    });

    await agentBrowser(config, [
      "open",
      new URL(paths.detailPath, config.appOrigin).toString(),
    ]);
    await waitForRouteText(config, {
      expectedText: ["Couldn't load automation"],
      name: "deleted automation detail",
      path: paths.detailPath,
    });

    console.log(`[smoke] completed automation delete ${automation.publicId}`);
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
  runAppAutomationDeleteSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
