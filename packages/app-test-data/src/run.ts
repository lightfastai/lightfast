import { assertScenario } from "./assert";
import { replayScenario } from "./replay";
import { seedScenario } from "./seed";
import type {
  AssertionOptions,
  LocalE2EScenario,
  ReplayOptions,
  RunScenarioResult,
} from "./types";

export async function runScenario(
  scenario: LocalE2EScenario,
  replayOptions: ReplayOptions = {},
  assertionOptions: AssertionOptions = {}
): Promise<RunScenarioResult> {
  const seededConnections = await seedScenario(scenario);
  const replayResults = await replayScenario(scenario, replayOptions);
  const assertions = await assertScenario(
    scenario,
    replayResults,
    assertionOptions
  );

  return {
    seededConnections,
    replayResults,
    assertions,
  };
}
