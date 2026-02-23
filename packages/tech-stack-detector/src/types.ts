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
	vector: DetectionVector;
	tier: Tier;
	confidence: number;
	/** For header/cookie checks — receives the value map */
	check?: (data: Record<string, string>) => boolean;
	/** For DNS/script_src/network_request pattern matching */
	pattern?: RegExp;
	/** For script_src/network_request domain matching */
	domains?: string[];
	/** For js_global checks — the global path to test (e.g. "window.Intercom") */
	global?: string;
}

export interface ToolSignature {
	id: string;
	name: string;
	category: Category;
	rules: DetectionRule[];
}

export interface RuleMatch {
	toolId: string;
	vector: DetectionVector;
	tier: Tier;
	confidence: number;
	evidence: string;
}

export type ConfidenceLevel = "detected" | "likely" | "possible";

export interface DetectedTool {
	id: string;
	name: string;
	category: Category;
	confidence: number;
	level: ConfidenceLevel;
	signals: RuleMatch[];
}

export interface DetectionResult {
	url: string;
	domain: string;
	detected: DetectedTool[];
	totalChecked: number;
	tiersUsed: Tier[];
	durationMs: number;
	unmatchedDomains?: string[];
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
	url: string;
	source: DiscoverySource[];
	kind: "subdomain" | "path";
	httpStatus?: number;
	scanned: boolean;
}

export interface DeepDetectOptions extends DetectOptions {
	deep?: boolean;
	maxDeepScans?: number;
	discoveryTimeout?: number;
}

export interface DeepDetectionResult {
	primary: DetectionResult;
	discovered: DiscoveredUrl[];
	subResults: DetectionResult[];
	allDetected: DetectedTool[];
	totalDurationMs: number;
	unmatchedDomains?: string[];
}
