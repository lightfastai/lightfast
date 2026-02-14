export type DimensionId =
  | "boundary_integrity"
  | "dependency_health"
  | "build_efficiency"
  | "type_safety"
  | "modularity"
  | "performance"
  | "documentation";

export type FindingTier = 1 | 2 | 3;

export type FindingStatus =
  | "open"
  | "addressed"
  | "deferred"
  | "dismissed"
  | "false_positive";

export interface Finding {
  id: string;
  tier: FindingTier;
  dimension: DimensionId;
  title: string;
  description: string;
  file?: string;
  line?: number;
  rule: string;
  tool: string;
  auto_fixable: boolean;
  status: FindingStatus;
  first_seen?: string;
}

export interface EvaluationSummary {
  total_findings: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  signal_ratio: number;
  packages_evaluated: number;
  packages_total: number;
  tools_used: string[];
}

export interface EvaluationResult {
  timestamp: string;
  git_sha: string;
  branch: string;
  findings: Finding[];
  summary: EvaluationSummary;
}

export interface PipelineConfig {
  dimensions: DimensionId[];
  thresholds: Record<string, number>;
  feature_flags: Record<string, boolean>;
}

export interface CollectorOutput {
  tool: string;
  raw_findings: RawFinding[];
  duration_ms: number;
  metadata?: {
    packages_evaluated?: number;
    packages_total?: number;
  };
}

export interface RawFinding {
  rule: string;
  message: string;
  file?: string;
  line?: number;
  severity: "error" | "warn" | "info";
  meta?: Record<string, unknown>;
}
