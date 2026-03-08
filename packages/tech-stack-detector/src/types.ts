export type Category =
  | "engineering"
  | "customer"
  | "revenue"
  | "growth"
  | "communication";

export type DetectionVector =
  | "header"
  | "cookie"
  | "script_src"
  | "meta_tag"
  | "inline_script"
  | "html_link"
  | "data_attr"
  | "dns_cname"
  | "dns_txt"
  | "dns_a"
  | "robots_txt"
  | "network_request"
  | "js_global"
  | "browser_cookie";

export type Tier = 1 | 2 | 3;

export interface DetectionRule {
  /** For header/cookie checks — receives the value map */
  check?: (data: Record<string, string>) => boolean;
  confidence: number;
  /** For script_src/network_request domain matching */
  domains?: string[];
  /** For js_global checks — the global path to test (e.g. "window.Intercom") */
  global?: string;
  /** For DNS/script_src/network_request pattern matching */
  pattern?: RegExp;
  tier: Tier;
  vector: DetectionVector;
}

export interface ToolSignature {
  category: Category;
  id: string;
  name: string;
  rules: DetectionRule[];
}

export interface RuleMatch {
  confidence: number;
  evidence: string;
  tier: Tier;
  toolId: string;
  vector: DetectionVector;
}

export type ConfidenceLevel = "detected" | "likely" | "possible";

export interface DetectedTool {
  category: Category;
  confidence: number;
  id: string;
  level: ConfidenceLevel;
  name: string;
  signals: RuleMatch[];
}

export interface DetectionResult {
  detected: DetectedTool[];
  domain: string;
  durationMs: number;
  tiersUsed: Tier[];
  totalChecked: number;
  unmatchedDomains?: string[];
  url: string;
}

export interface DetectOptions {
  skipBrowser?: boolean;
  timeout?: number;
}

// ━━━ Discovery Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type DiscoverySource =
  | "link_extraction"
  | "ct_log"
  | "common_prefix"
  | "network_request"
  | "path_detection";

export interface DiscoveredUrl {
  httpStatus?: number;
  kind: "subdomain" | "path";
  scanned: boolean;
  source: DiscoverySource[];
  url: string;
}

export interface DeepDetectOptions extends DetectOptions {
  deep?: boolean;
  discoveryTimeout?: number;
  maxDeepScans?: number;
}

export interface DeepDetectionResult {
  allDetected: DetectedTool[];
  discovered: DiscoveredUrl[];
  primary: DetectionResult;
  subResults: DetectionResult[];
  totalDurationMs: number;
  unmatchedDomains?: string[];
}
