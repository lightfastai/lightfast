/**
 * Pino logger configuration for the web app
 */

import { createPinoLoggerFactory } from "lightfast/v2";
import pino from "pino";
import { env } from "@/env";

// Create base pino logger - simple JSON output for serverless compatibility
const pinoInstance = pino({
	level: env.NODE_ENV === "production" ? "info" : "debug",
	formatters: {
		level: (label) => {
			return { level: label };
		},
		bindings: (bindings) => {
			return {
				...bindings,
				environment: env.NODE_ENV,
			};
		},
	},
	serializers: {
		err: pino.stdSerializers.err,
		error: pino.stdSerializers.err,
		// Custom serializer for tool results to avoid huge logs
		result: (result: any) => {
			if (typeof result === "string" && result.length > 1000) {
				return `${result.substring(0, 1000)}... (truncated)`;
			}
			return result;
		},
		// Custom serializer for args to redact sensitive data
		args: (args: Record<string, any>) => {
			const redacted = { ...args };
			// Redact potential sensitive fields
			const sensitiveFields = ["password", "token", "apiKey", "secret"];
			for (const field of sensitiveFields) {
				if (field in redacted) {
					redacted[field] = "[REDACTED]";
				}
			}
			return redacted;
		},
	},
	// Add request ID and other metadata
	base: {
		service: "lightfast-www",
		version: process.env.npm_package_version,
	},
});

// Create the logger factory
export const loggerFactory = createPinoLoggerFactory(pinoInstance);

// Export a default logger for general use
export const logger = pinoInstance;
