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
  collectRouteBodyProblems,
  createAppTanstackAuthSmokeSession,
  readPageState,
} from "./auth-route-smoke";

export interface AppTanstackAutomationInteractionFixture {
  createName: string;
  createPrompt: string;
  updateName: string;
  updatePrompt: string;
}

export interface AppTanstackAutomationInteractionPaths {
  listPath: string;
  newPath: string;
}

interface WaitForRouteTextInput {
  expectedText: string[];
  name: string;
  path: string;
}

interface ClickAutomationLinkResult {
  href: string;
}

export function buildAppTanstackAutomationInteractionFixture(
  input: { nowMs?: number } = {}
): AppTanstackAutomationInteractionFixture {
  const timestampMs = input.nowMs ?? Date.now();
  return {
    createName: `UI smoke automation ${timestampMs}`,
    createPrompt: "Created through app-tanstack automation interaction smoke.",
    updateName: `Updated UI smoke automation ${timestampMs}`,
    updatePrompt: "Updated through app-tanstack automation interaction smoke.",
  };
}

export function buildAppTanstackAutomationInteractionPaths(
  orgSlug: string
): AppTanstackAutomationInteractionPaths {
  return {
    listPath: `/${orgSlug}/automations`,
    newPath: `/${orgSlug}/automations/new`,
  };
}

async function waitForRouteText(
  config: AppTanstackAuthRouteSmokeConfig,
  input: WaitForRouteTextInput
) {
  const deadline = Date.now() + config.routeTimeoutMs;
  let latestState:
    | {
        bodyText: string;
        href: string;
        pathname: string;
      }
    | undefined;
  let latestProblems: string[] = [];

  while (Date.now() < deadline) {
    latestState = await readPageState(config);
    latestProblems = collectRouteBodyProblems({
      bodyText: latestState.bodyText,
      expectedText: input.expectedText,
      finalPathname: latestState.pathname,
      routeName: input.name,
      routePath: input.path,
    });
    if (latestProblems.length === 0) {
      return latestState;
    }
    await delay(500);
  }

  const snapshot = await agentBrowser(config, ["snapshot", "-i", "-u"]).catch(
    (error) => String(error)
  );
  throw new Error(
    [
      `Automation interaction smoke failed for ${input.name} (${input.path}).`,
      ...latestProblems,
      latestState ? `Last URL: ${latestState.href}` : "Last URL: <unknown>",
      snapshot,
    ].join("\n")
  );
}

async function clickAutomationLinkByName(
  config: AppTanstackAuthRouteSmokeConfig,
  name: string
): Promise<ClickAutomationLinkResult> {
  const deadline = Date.now() + config.routeTimeoutMs;
  let latestLinks: Array<{ href: string; text: string }> = [];

  while (Date.now() < deadline) {
    const raw = await agentEval(
      config,
      `(() => {
        const name = ${JSON.stringify(name)};
        const links = Array.from(document.querySelectorAll("a"));
        const link = links.find(
          (element) =>
            element instanceof HTMLAnchorElement &&
            element.href.includes("/automations/") &&
            element.textContent?.includes(name)
        );
        if (!(link instanceof HTMLAnchorElement)) {
          return {
            clicked: false,
            links: links
              .map((element) => ({
                href: element instanceof HTMLAnchorElement ? element.href : "",
                text: element.textContent?.trim() ?? "",
              }))
              .slice(0, 20),
          };
        }
        link.click();
        return { clicked: true, href: link.href };
      })()`
    );
    const result = JSON.parse(raw) as
      | { clicked: false; links: Array<{ href: string; text: string }> }
      | { clicked: true; href: string };
    if (result.clicked) {
      return { href: result.href };
    }
    latestLinks = result.links;
    await delay(500);
  }

  throw new Error(
    `Could not find automation link for "${name}". Links: ${JSON.stringify(
      latestLinks
    )}`
  );
}

async function clickButtonByText(
  config: AppTanstackAuthRouteSmokeConfig,
  name: string
) {
  const raw = await agentEval(
    config,
    `(() => {
      const name = ${JSON.stringify(name)};
      const button = Array.from(document.querySelectorAll("button")).find(
        (element) =>
          element instanceof HTMLButtonElement &&
          element.textContent?.trim() === name
      );
      if (!(button instanceof HTMLButtonElement)) {
        return { clicked: false, reason: "missing" };
      }
      if (button.disabled) {
        return { clicked: false, reason: "disabled" };
      }
      button.click();
      return { clicked: true };
    })()`
  );
  const result = JSON.parse(raw) as
    | { clicked: false; reason: string }
    | { clicked: true };
  if (!result.clicked) {
    throw new Error(`Could not click "${name}" button: ${result.reason}`);
  }
}

function extractAutomationPublicId(href: string): string {
  const url = new URL(href);
  const segments = url.pathname.split("/").filter(Boolean);
  const automationsIndex = segments.indexOf("automations");
  const publicId =
    automationsIndex >= 0 ? segments[automationsIndex + 1] : undefined;
  if (!publicId || publicId === "new") {
    throw new Error(`Could not extract automation public id from ${href}`);
  }
  return publicId;
}

async function blurActiveElement(config: AppTanstackAuthRouteSmokeConfig) {
  await agentEval(
    config,
    `(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      return { activeElement: document.activeElement?.tagName ?? null };
    })()`
  );
}

async function waitForTextareaByAriaLabel(
  config: AppTanstackAuthRouteSmokeConfig,
  label: string
) {
  const deadline = Date.now() + config.routeTimeoutMs;
  let latestLabels: string[] = [];

  while (Date.now() < deadline) {
    const raw = await agentEval(
      config,
      `(() => {
        const label = ${JSON.stringify(label)};
        const textareas = Array.from(document.querySelectorAll("textarea"));
        return {
          exists: textareas.some(
            (element) => element.getAttribute("aria-label") === label
          ),
          labels: textareas.map(
            (element) => element.getAttribute("aria-label") ?? ""
          ),
        };
      })()`
    );
    const result = JSON.parse(raw) as {
      exists: boolean;
      labels: string[];
    };
    if (result.exists) {
      return;
    }
    latestLabels = result.labels;
    await delay(500);
  }

  throw new Error(
    `Textarea "${label}" did not render. Latest textarea labels: ${JSON.stringify(
      latestLabels
    )}`
  );
}

async function waitForAutomationPersisted(input: {
  config: AppTanstackAuthRouteSmokeConfig;
  expectedName: string;
  expectedPrompt: string;
  orgId: string;
  publicId: string;
}) {
  const [{ db }, { getAutomationByPublicId }] = await Promise.all([
    import("@db/app/client"),
    import("@db/app"),
  ]);
  const deadline = Date.now() + input.config.routeTimeoutMs;
  let latest:
    | {
        name: string;
        prompt: string;
      }
    | undefined;

  while (Date.now() < deadline) {
    const automation = await getAutomationByPublicId(db, {
      clerkOrgId: input.orgId,
      publicId: input.publicId,
    });
    latest = automation
      ? { name: automation.name, prompt: automation.prompt }
      : undefined;
    if (
      automation?.name === input.expectedName &&
      automation.prompt === input.expectedPrompt
    ) {
      return automation;
    }
    await delay(500);
  }

  throw new Error(
    `Automation ${input.publicId} did not persist expected edits. Last row: ${JSON.stringify(
      latest
    )}`
  );
}

export async function runAppTanstackAutomationInteractionSmoke(
  input: BuildAppTanstackAuthRouteSmokeConfigInput = {}
) {
  const nowMs = input.nowMs ?? Date.now();
  const fixture = buildAppTanstackAutomationInteractionFixture({ nowMs });
  let config: AppTanstackAuthRouteSmokeConfig | undefined;
  let session: AppTanstackAuthSmokeSession | undefined;

  try {
    session = await createAppTanstackAuthSmokeSession({
      ...input,
      nowMs,
    });
    config = session.config;
    const paths = buildAppTanstackAutomationInteractionPaths(session.orgSlug);

    console.log(`[smoke] app=${config.appOrigin}`);
    console.log(`[smoke] org=${session.orgSlug}`);
    console.log(`[smoke] create=${fixture.createName}`);

    await agentBrowser(config, [
      "open",
      new URL(paths.newPath, config.appOrigin).toString(),
    ]);
    await waitForRouteText(config, {
      expectedText: ["New automation", "Name", "Instructions", "Schedule"],
      name: "new automation form",
      path: paths.newPath,
    });

    await agentBrowser(config, [
      "find",
      "placeholder",
      "Daily code review",
      "fill",
      fixture.createName,
    ]);
    await agentBrowser(config, [
      "find",
      "placeholder",
      "Describe what the agent should do in each run.",
      "fill",
      fixture.createPrompt,
    ]);
    await waitForRouteText(config, {
      expectedText: [
        "New automation",
        fixture.createName,
        fixture.createPrompt,
      ],
      name: "new automation form after fill",
      path: paths.newPath,
    });
    await clickButtonByText(config, "Create");

    await waitForRouteText(config, {
      expectedText: ["Automations", fixture.createName],
      name: "automation list after create",
      path: paths.listPath,
    });

    const clicked = await clickAutomationLinkByName(config, fixture.createName);
    const automationPublicId = extractAutomationPublicId(clicked.href);
    const detailPath = new URL(clicked.href).pathname;

    await waitForRouteText(config, {
      expectedText: [
        fixture.createName,
        fixture.createPrompt,
        "Status",
        "Actions",
        "Previous runs",
      ],
      name: "automation detail after create",
      path: detailPath,
    });

    await waitForTextareaByAriaLabel(config, "Automation name");
    await agentBrowser(config, [
      "fill",
      'textarea[aria-label="Automation name"]',
      fixture.updateName,
    ]);
    await agentBrowser(config, [
      "fill",
      'textarea[aria-label="Instructions"]',
      fixture.updatePrompt,
    ]);
    await blurActiveElement(config);
    await waitForAutomationPersisted({
      config,
      expectedName: fixture.updateName,
      expectedPrompt: fixture.updatePrompt,
      orgId: session.orgId,
      publicId: automationPublicId,
    });

    await agentBrowser(config, [
      "open",
      new URL(detailPath, config.appOrigin).toString(),
    ]);
    await waitForRouteText(config, {
      expectedText: [
        fixture.updateName,
        fixture.updatePrompt,
        "Status",
        "Actions",
        "Previous runs",
      ],
      name: "automation detail after edit reload",
      path: detailPath,
    });

    await agentBrowser(config, [
      "open",
      new URL(paths.listPath, config.appOrigin).toString(),
    ]);
    await waitForRouteText(config, {
      expectedText: ["Automations", fixture.updateName],
      name: "automation list after edit",
      path: paths.listPath,
    });

    console.log(
      `[smoke] completed automation interaction ${automationPublicId}`
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
  runAppTanstackAutomationInteractionSmoke().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
