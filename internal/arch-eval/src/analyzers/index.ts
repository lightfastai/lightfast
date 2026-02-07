import type { CollectorOutput, Finding, PipelineConfig } from "../types.js";
import { analyzeBoundaryIntegrity } from "./boundary-integrity.js";
import { analyzeDependencyHealth } from "./dependency-health.js";
import { analyzeBuildEfficiency } from "./build-efficiency.js";
import { analyzeTypeSafety } from "./type-safety.js";

export function analyzeAll(
  collectorOutputs: CollectorOutput[],
  config: PipelineConfig
): Finding[] {
  const findings: Finding[] = [];

  // Run each analyzer
  if (config.dimensions.includes("boundary_integrity")) {
    findings.push(...analyzeBoundaryIntegrity(collectorOutputs));
  }

  if (config.dimensions.includes("dependency_health")) {
    findings.push(...analyzeDependencyHealth(collectorOutputs, config));
  }

  if (config.dimensions.includes("build_efficiency")) {
    findings.push(...analyzeBuildEfficiency(collectorOutputs, config));
  }

  if (config.dimensions.includes("type_safety")) {
    findings.push(...analyzeTypeSafety(collectorOutputs, config));
  }

  return findings;
}

export {
  analyzeBoundaryIntegrity,
  analyzeDependencyHealth,
  analyzeBuildEfficiency,
  analyzeTypeSafety,
};
