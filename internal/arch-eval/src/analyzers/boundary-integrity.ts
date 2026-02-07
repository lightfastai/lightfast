import type { CollectorOutput, Finding, RawFinding } from "../types.js";

let findingCounter = 1;

function generateFindingId(): string {
  return `BND-${String(findingCounter++).padStart(3, "0")}`;
}

export function analyzeBoundaryIntegrity(
  collectorOutputs: CollectorOutput[]
): Finding[] {
  const findings: Finding[] = [];
  const timestamp = new Date().toISOString();

  // Get dependency-cruiser and turbo-boundaries outputs
  const depcruiseOutput = collectorOutputs.find(
    (o) => o.tool === "dependency-cruiser"
  );
  const turboBoundariesOutput = collectorOutputs.find(
    (o) => o.tool === "turbo-boundaries"
  );

  // Group dependency-cruiser findings by rule
  const groupedFindings = new Map<string, RawFinding[]>();

  if (depcruiseOutput) {
    for (const raw of depcruiseOutput.raw_findings) {
      const key = raw.rule;
      if (!groupedFindings.has(key)) {
        groupedFindings.set(key, []);
      }
      groupedFindings.get(key)!.push(raw);
    }
  }

  // Process layer violations (Tier 1)
  const layerRules = [
    "no-app-to-app-imports",
    "no-package-to-app-imports",
    "no-package-to-api-imports",
    "no-app-to-db-imports",
    "no-circular-packages",
  ];

  for (const rule of layerRules) {
    const violations = groupedFindings.get(rule) || [];
    if (violations.length > 0) {
      const firstViolation = violations[0];
      findings.push({
        id: generateFindingId(),
        tier: 1,
        dimension: "boundary_integrity",
        title: getTitleForRule(rule, violations.length),
        description: getDescriptionForRule(rule, violations),
        file: firstViolation?.file,
        rule,
        tool: "dependency-cruiser",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    }
  }

  // Process vendor abstraction violations (Tier 2, unless circular → Tier 1)
  const vendorRules = Array.from(groupedFindings.keys()).filter((r) =>
    r.startsWith("vendor-only-")
  );

  for (const rule of vendorRules) {
    const violations = groupedFindings.get(rule) || [];
    if (violations.length > 0) {
      const firstViolation = violations[0];
      const isCircular = rule.includes("circular");
      findings.push({
        id: generateFindingId(),
        tier: isCircular ? 1 : 2,
        dimension: "boundary_integrity",
        title: getTitleForRule(rule, violations.length),
        description: getDescriptionForRule(rule, violations),
        file: firstViolation?.file,
        rule,
        tool: "dependency-cruiser",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    }
  }

  // Process domain boundary warnings (Tier 3)
  const domainRules = Array.from(groupedFindings.keys()).filter(
    (r) => r.includes("domain-boundary") || r.includes("console-packages")
  );

  for (const rule of domainRules) {
    const violations = groupedFindings.get(rule) || [];
    if (violations.length > 0) {
      const firstViolation = violations[0];
      findings.push({
        id: generateFindingId(),
        tier: 3,
        dimension: "boundary_integrity",
        title: getTitleForRule(rule, violations.length),
        description: getDescriptionForRule(rule, violations),
        file: firstViolation?.file,
        rule,
        tool: "dependency-cruiser",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    }
  }

  // Process turbo-boundaries violations (Tier 2)
  if (turboBoundariesOutput) {
    const undeclaredDeps = turboBoundariesOutput.raw_findings.filter((f) =>
      f.message.includes("without declaring")
    );
    if (undeclaredDeps.length > 0) {
      findings.push({
        id: generateFindingId(),
        tier: 2,
        dimension: "boundary_integrity",
        title: `Undeclared dependencies (${undeclaredDeps.length} violations)`,
        description: `turbo boundaries detected ${undeclaredDeps.length} undeclared dependencies. ${undeclaredDeps
          .slice(0, 3)
          .map((f) => f.message)
          .join("; ")}${undeclaredDeps.length > 3 ? "..." : ""}`,
        rule: "undeclared-dependency",
        tool: "turbo-boundaries",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    }

    const deepImports = turboBoundariesOutput.raw_findings.filter((f) =>
      f.message.includes("deep import")
    );
    if (deepImports.length > 0) {
      findings.push({
        id: generateFindingId(),
        tier: 2,
        dimension: "boundary_integrity",
        title: `Deep imports leaving package boundaries (${deepImports.length} violations)`,
        description: `turbo boundaries detected ${deepImports.length} deep imports. ${deepImports
          .slice(0, 3)
          .map((f) => f.message)
          .join("; ")}${deepImports.length > 3 ? "..." : ""}`,
        rule: "deep-imports",
        tool: "turbo-boundaries",
        auto_fixable: false,
        status: "open",
        first_seen: timestamp,
      });
    }
  }

  return findings;
}

function getTitleForRule(rule: string, count: number): string {
  const titles: Record<string, string> = {
    "no-app-to-app-imports": "Apps importing from other apps",
    "no-package-to-app-imports": "Packages importing from apps",
    "no-package-to-api-imports": "Packages importing from API layer",
    "no-app-to-db-imports": "Apps importing from DB directly",
    "no-circular-packages": "Circular dependencies detected",
    "no-vendor-to-package-imports": "Vendor packages importing from packages",
    "no-vendor-to-api-imports": "Vendor packages importing from API",
    "console-packages-domain-boundary": "Console packages used outside console",
  };

  const baseTitle = titles[rule] || rule.replace(/-/g, " ");
  return `${baseTitle} (${count} violations)`;
}

function getDescriptionForRule(
  rule: string,
  violations: RawFinding[]
): string {
  const fileList = violations
    .slice(0, 5)
    .map((v) => `- ${v.message}`)
    .join("\n");
  const remaining = violations.length > 5 ? `\n... and ${violations.length - 5} more` : "";
  return `${violations.length} violation(s) detected:\n${fileList}${remaining}`;
}
