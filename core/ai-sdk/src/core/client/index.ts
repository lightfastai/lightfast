import type { Agent } from "../primitives/agent";

/**
 * Collection of agents available in a Lightfast instance
 */
export type LightfastAgentSet = Record<string, Agent>;

/**
 * Dev server configuration options
 */
export interface LightfastDevConfig {
	/**
	 * Port for the dev UI (defaults to 3000)
	 */
	port?: number;

	/**
	 * Enable hot reload (defaults to true)
	 */
	hotReload?: boolean;

	/**
	 * Enable verbose logging (defaults to false)
	 */
	verbose?: boolean;
}

/**
 * Metadata about the Lightfast instance
 */
export interface LightfastMetadata {
	/**
	 * Name of the project
	 */
	name?: string;

	/**
	 * Version of the project
	 */
	version?: string;

	/**
	 * Description of the project
	 */
	description?: string;
}

/**
 * Configuration options for the Lightfast client
 */
export interface LightfastConfig {
	/**
	 * Collection of agents available in this Lightfast instance
	 * Each agent is identified by a unique key
	 */
	agents: LightfastAgentSet;

	/**
	 * Optional configuration for the dev server
	 */
	dev?: LightfastDevConfig;

	/**
	 * Optional metadata about the Lightfast instance
	 */
	metadata?: LightfastMetadata;
}

/**
 * The main Lightfast client class
 * 
 * @example
 * ```typescript
 * import { Lightfast } from "@lightfastai/ai-sdk/client";
 * import { createAgent } from "@lightfastai/ai-sdk/agent";
 * 
 * const myAgent = createAgent({
 *   name: "my-agent",
 *   system: "You are a helpful assistant",
 *   model: anthropic("claude-3-5-sonnet-20241022"),
 * });
 * 
 * const lightfast = new Lightfast({
 *   agents: {
 *     myAgent,
 *   },
 * });
 * 
 * export default lightfast;
 * ```
 */
export class Lightfast {
	private readonly config: LightfastConfig;

	constructor(config: LightfastConfig) {
		this.validateConfig(config);
		this.config = config;
	}

	/**
	 * Validates the configuration
	 */
	private validateConfig(config: LightfastConfig): void {
		 
		if (!config.agents || typeof config.agents !== "object") {
			throw new Error("Lightfast configuration must include 'agents' object");
		}

		const agentKeys = Object.keys(config.agents);
		if (agentKeys.length === 0) {
			throw new Error("At least one agent must be configured");
		}

		// Validate each agent
		for (const [key, agent] of Object.entries(config.agents)) {
			 
			if (!agent || typeof agent !== "object") {
				throw new Error(`Agent '${key}' is not a valid Agent instance`);
			}

			// Check if it has the expected Agent properties
			if (!("name" in agent) || !("model" in agent)) {
				throw new Error(
					`Agent '${key}' does not appear to be a valid Agent instance (missing required properties)`,
				);
			}
		}

		// Validate dev config if provided
		if (config.dev) {
			if (config.dev.port !== undefined) {
				if (typeof config.dev.port !== "number" || config.dev.port < 1 || config.dev.port > 65535) {
					throw new Error("Dev port must be a valid port number (1-65535)");
				}
			}
		}
	}

	/**
	 * Get all configured agents
	 */
	getAgents(): LightfastAgentSet {
		return this.config.agents;
	}

	/**
	 * Get a specific agent by key
	 */
	getAgent(key: string): Agent | undefined {
		return this.config.agents[key];
	}

	/**
	 * Get all agent keys
	 */
	getAgentKeys(): string[] {
		return Object.keys(this.config.agents);
	}

	/**
	 * Get the configuration
	 */
	getConfig(): LightfastConfig {
		return this.config;
	}

	/**
	 * Get metadata
	 */
	getMetadata(): LightfastMetadata | undefined {
		return this.config.metadata;
	}

	/**
	 * Get dev configuration
	 */
	getDevConfig(): LightfastDevConfig | undefined {
		return this.config.dev;
	}

	/**
	 * Export configuration for CLI consumption
	 * This method is used by the CLI to discover and display agents
	 */
	toJSON(): LightfastJSON {
		return {
			agents: this.config.agents,
			metadata: this.config.metadata,
			dev: this.config.dev,
		};
	}

	/**
	 * Static method to create a new Lightfast instance
	 */
	static create(config: LightfastConfig): Lightfast {
		return new Lightfast(config);
	}
}

/**
 * Factory function to create a Lightfast client
 * 
 * @example
 * ```typescript
 * import { createLightfast } from "@lightfastai/ai-sdk/client";
 * import { someAgent } from "./agents/some-agent";
 * 
 * export default createLightfast({
 *   agents: {
 *     someAgent,
 *   },
 * });
 * ```
 */
export function createLightfast(config: LightfastConfig): Lightfast {
	return new Lightfast(config);
}

// Re-export the Agent type for convenience
export type { Agent, AgentOptions } from "../primitives/agent";

// Export the type of the JSON representation
export interface LightfastJSON {
	agents: LightfastAgentSet;
	metadata?: LightfastMetadata;
	dev?: LightfastDevConfig;
}