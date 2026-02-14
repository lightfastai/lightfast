import type {
  CollectorOutput,
  Finding,
  PipelineConfig,
} from "../types.js";

let findingCounter = 1;

function generateFindingId(): string {
  return `BLD-${String(findingCounter++).padStart(3, "0")}`;
}

export function analyzeBuildEfficiency(
  collectorOutputs: CollectorOutput[],
  config: PipelineConfig
): Finding[] {
  const findings: Finding[] = [];
  const timestamp = new Date().toISOString();

  const turboSummaryOutput = collectorOutputs.find(
    (o) => o.tool === "turbo-summary"
  );
  if (!turboSummaryOutput) {
    return findings;
  }

  // Process turbo summary findings
  for (const raw of turboSummaryOutput.raw_findings) {
    if (raw.rule === "low-cache-hit-rate") {
      findings.push({
        id: generateFindingId(),
        tier: 2,
        dimension: "build_efficiency",
        title: "Low Turbo cache hit rate",
        description: raw.message,
        rule: raw.rule,
        tool: "turbo-summary",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    } else if (raw.rule === "long-build-time") {
      findings.push({
        id: generateFindingId(),
        tier: 3,
        dimension: "build_efficiency",
        title: "Long build time",
        description: raw.message,
        rule: raw.rule,
        tool: "turbo-summary",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    }
  }

  return findings;
}
