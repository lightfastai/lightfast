import type {
  CollectorOutput,
  Finding,
  PipelineConfig,
  RawFinding,
} from "../types.js";

let findingCounter = 1;

function generateFindingId(): string {
  return `DEP-${String(findingCounter++).padStart(3, "0")}`;
}

export function analyzeDependencyHealth(
  collectorOutputs: CollectorOutput[],
  config: PipelineConfig
): Finding[] {
  const findings: Finding[] = [];
  const timestamp = new Date().toISOString();

  const knipOutput = collectorOutputs.find((o) => o.tool === "knip");
  if (!knipOutput) {
    return findings;
  }

  // Group findings by category
  const groupedByCategory = new Map<string, RawFinding[]>();
  for (const raw of knipOutput.raw_findings) {
    const category = raw.rule.replace("knip-", "");
    if (!groupedByCategory.has(category)) {
      groupedByCategory.set(category, []);
    }
    groupedByCategory.get(category)!.push(raw);
  }

  // Unused dependencies → Tier 2
  const unusedDeps = groupedByCategory.get("dependencies") || [];
  if (unusedDeps.length > 0) {
    findings.push({
      id: generateFindingId(),
      tier: 2,
      dimension: "dependency_health",
      title: `Unused dependencies (${unusedDeps.length} packages)`,
      description: `${unusedDeps.length} unused dependencies detected:\n${unusedDeps
        .slice(0, 5)
        .map((d) => `- ${d.message}`)
        .join("\n")}${unusedDeps.length > 5 ? `\n... and ${unusedDeps.length - 5} more` : ""}`,
      rule: "unused-dependencies",
      tool: "knip",
      auto_fixable: true,
      status: "open",
      first_seen: timestamp,
    });
  }

  // Unused files → Tier 2
  const unusedFiles = groupedByCategory.get("files") || [];
  if (unusedFiles.length > 0) {
    findings.push({
      id: generateFindingId(),
      tier: 2,
      dimension: "dependency_health",
      title: `Unused files (${unusedFiles.length} files)`,
      description: `${unusedFiles.length} unused files detected:\n${unusedFiles
        .slice(0, 5)
        .map((f) => `- ${f.file || f.message}`)
        .join("\n")}${unusedFiles.length > 5 ? `\n... and ${unusedFiles.length - 5} more` : ""}`,
      rule: "unused-files",
      tool: "knip",
      auto_fixable: false,
      status: "open",
      first_seen: timestamp,
    });
  }

  // Unused exports → Tier 2 if above threshold, Tier 3 otherwise
  const unusedExports = groupedByCategory.get("exports") || [];
  const threshold = config.thresholds.unused_exports_per_package || 10;

  // Group by package
  const exportsByPackage = new Map<string, RawFinding[]>();
  for (const exp of unusedExports) {
    const pkg = exp.file?.split("/").slice(0, 2).join("/") || "unknown";
    if (!exportsByPackage.has(pkg)) {
      exportsByPackage.set(pkg, []);
    }
    exportsByPackage.get(pkg)!.push(exp);
  }

  // Find packages above threshold
  const packagesAboveThreshold = Array.from(exportsByPackage.entries()).filter(
    ([, exports]) => exports.length > threshold
  );

  if (packagesAboveThreshold.length > 0) {
    for (const [pkg, exports] of packagesAboveThreshold) {
      findings.push({
        id: generateFindingId(),
        tier: 2,
        dimension: "dependency_health",
        title: `Excessive unused exports in ${pkg} (${exports.length} exports)`,
        description: `${pkg} has ${exports.length} unused exports (threshold: ${threshold}):\n${exports
          .slice(0, 5)
          .map((e) => `- ${e.message}`)
          .join("\n")}${exports.length > 5 ? `\n... and ${exports.length - 5} more` : ""}`,
        file: pkg,
        rule: "excessive-unused-exports",
        tool: "knip",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    }
  }

  // Minor unused exports → Tier 3
  const minorUnusedExports = Array.from(exportsByPackage.entries()).filter(
    ([, exports]) => exports.length <= threshold && exports.length > 0
  );

  if (minorUnusedExports.length > 0) {
    const totalMinor = minorUnusedExports.reduce(
      (sum, [, exports]) => sum + exports.length,
      0
    );
    findings.push({
      id: generateFindingId(),
      tier: 3,
      dimension: "dependency_health",
      title: `Minor unused exports (${totalMinor} exports across ${minorUnusedExports.length} packages)`,
      description: `${totalMinor} unused exports detected below threshold (${threshold} per package) across ${minorUnusedExports.length} packages`,
      rule: "minor-unused-exports",
      tool: "knip",
      auto_fixable: false,
      status: "open",
      first_seen: timestamp,
    });
  }

  // Unused types → Tier 3
  const unusedTypes = groupedByCategory.get("types") || [];
  if (unusedTypes.length > 0) {
    findings.push({
      id: generateFindingId(),
      tier: 3,
      dimension: "dependency_health",
      title: `Unused types (${unusedTypes.length} types)`,
      description: `${unusedTypes.length} unused type definitions detected`,
      rule: "unused-types",
      tool: "knip",
      auto_fixable: false,
      status: "open",
      first_seen: timestamp,
    });
  }

  return findings;
}
