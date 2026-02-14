import type { CollectorOutput, PipelineConfig } from "../types.js";
import { collectDependencyCruiser } from "./dependency-cruiser.js";
import { collectKnip } from "./knip.js";
import { collectTurboBoundaries } from "./turbo-boundaries.js";
import { collectTurboSummary } from "./turbo-summary.js";

export interface CollectorOptions {
  quick?: boolean;
}

export async function runAllCollectors(
  config: PipelineConfig,
  options: CollectorOptions = {}
): Promise<CollectorOutput[]> {
  const outputs: CollectorOutput[] = [];

  // Always run dependency-cruiser (primary boundary enforcer)
  outputs.push(collectDependencyCruiser());

  // Always run turbo-boundaries if feature flag enabled
  outputs.push(collectTurboBoundaries(config));

  // Skip heavy collectors in quick mode
  if (!options.quick) {
    outputs.push(collectKnip());
    outputs.push(collectTurboSummary());
  }

  return outputs;
}

export {
  collectDependencyCruiser,
  collectKnip,
  collectTurboBoundaries,
  collectTurboSummary,
};
