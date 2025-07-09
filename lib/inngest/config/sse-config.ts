/**
 * SSE Configuration
 * Controls the verbosity and behavior of SSE event emission
 */

export interface SSEConfig {
	// Enable/disable SSE events globally
	enabled: boolean;

	// Verbosity levels
	verbosity: "minimal" | "normal" | "verbose" | "debug";

	// Event filtering
	eventFilter?: {
		includeSteps?: boolean;
		includeEvents?: boolean;
		includeProgress?: boolean;
		includeDebugInfo?: boolean;
	};

	// Rate limiting
	rateLimit?: {
		maxEventsPerSecond?: number;
		batchDelay?: number; // ms to wait before sending batched events
	};
}

// Default configuration
export const defaultSSEConfig: SSEConfig = {
	enabled: true,
	verbosity: "normal",
	eventFilter: {
		includeSteps: true,
		includeEvents: true,
		includeProgress: true,
		includeDebugInfo: false,
	},
	rateLimit: {
		maxEventsPerSecond: 10,
		batchDelay: 100,
	},
};

// Global SSE configuration (can be overridden per function)
let globalConfig = { ...defaultSSEConfig };

export function setSSEConfig(config: Partial<SSEConfig>) {
	globalConfig = { ...globalConfig, ...config };
}

export function getSSEConfig(): SSEConfig {
	return globalConfig;
}

// Check if a specific type of event should be emitted based on verbosity
export function shouldEmitEvent(eventType: "step" | "event" | "progress" | "debug"): boolean {
	if (!globalConfig.enabled) return false;

	const { verbosity, eventFilter } = globalConfig;

	switch (eventType) {
		case "step":
			return verbosity !== "minimal" && (eventFilter?.includeSteps ?? true);
		case "event":
			return eventFilter?.includeEvents ?? true;
		case "progress":
			return verbosity !== "minimal" && (eventFilter?.includeProgress ?? true);
		case "debug":
			return verbosity === "debug" && (eventFilter?.includeDebugInfo ?? false);
		default:
			return true;
	}
}
