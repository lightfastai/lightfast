export { detect } from "./pipeline.js";
export { deepDetect } from "./deep-detect.js";
export { discover } from "./discovery/index.js";
export { SIGNATURES } from "./registry.js";
export type {
	Category,
	ConfidenceLevel,
	DeepDetectOptions,
	DeepDetectionResult,
	DetectOptions,
	DetectedTool,
	DetectionResult,
	DetectionRule,
	DetectionVector,
	DiscoveredUrl,
	DiscoverySource,
	RuleMatch,
	Tier,
	ToolSignature,
} from "./types.js";
