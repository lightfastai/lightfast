import { parseArgs } from "node:util";
import { doctor } from "./doctor";
import { replayScenario } from "./replay";
import { runScenario } from "./run";
import { getScenario, scenarios } from "./scenarios/index";
import { seedScenario } from "./seed";
import type { ReplayTarget } from "./types";

function printUsage(): void {
  console.log(`Usage:
  pnpm --filter @repo/app-test-data sandbox:list
  pnpm --filter @repo/app-test-data sandbox:doctor
  pnpm --filter @repo/app-test-data sandbox:seed -- <scenario>
  pnpm --filter @repo/app-test-data sandbox:replay -- <scenario> [--target platform|app] [--base-url URL]
  pnpm --filter @repo/app-test-data sandbox:run -- <scenario> [--target platform|app] [--base-url URL] [--timeout-ms NUMBER]

Options:
  --json                  Print JSON output
  --target                Replay target: platform or app
  --base-url              Override the selected target base URL
  --timeout-ms            Assertion timeout used by run
`);
}

function parseTarget(value: string | undefined): ReplayTarget | undefined {
  if (value === undefined) {
    return;
  }
  if (value === "app" || value === "platform") {
    return value;
  }
  throw new Error(`Invalid --target value "${value}"`);
}

function parseTimeout(value: string | undefined): number | undefined {
  if (value === undefined) {
    return;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid --timeout-ms value "${value}"`);
  }
  return parsed;
}

function printOutput(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.dir(value, { depth: null, colors: true });
}

function requireScenarioName(
  command: string,
  name: string | undefined
): string {
  if (!name) {
    const known = scenarios.map((scenario) => scenario.name).join(", ");
    throw new Error(
      `Missing scenario name for ${command}. Known scenarios: ${known}`
    );
  }
  return name;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      json: { type: "boolean", default: false },
      target: { type: "string" },
      "base-url": { type: "string" },
      "timeout-ms": { type: "string" },
    },
  });

  const [command, scenarioName] = positionals;
  const json = values.json ?? false;
  const target = parseTarget(values.target);
  const baseUrl = values["base-url"];
  const timeoutMs = parseTimeout(values["timeout-ms"]);

  switch (command) {
    case "list":
      printOutput(
        scenarios.map((scenario) => ({
          name: scenario.name,
          description: scenario.description,
        })),
        json
      );
      return;

    case "doctor":
      printOutput(await doctor(), json);
      return;

    case "seed": {
      const scenario = getScenario(requireScenarioName("seed", scenarioName));
      printOutput(await seedScenario(scenario), json);
      return;
    }

    case "replay": {
      const scenario = getScenario(requireScenarioName("replay", scenarioName));
      printOutput(await replayScenario(scenario, { target, baseUrl }), json);
      return;
    }

    case "run": {
      const scenario = getScenario(requireScenarioName("run", scenarioName));
      printOutput(
        await runScenario(scenario, { target, baseUrl }, { timeoutMs }),
        json
      );
      return;
    }

    case undefined:
      printUsage();
      return;

    default:
      printUsage();
      throw new Error(`Unknown command "${command}"`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
