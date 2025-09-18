import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment configuration for Braintrust observability
 * Validates required environment variables for Braintrust integration
 */
export const braintrustEnv = createEnv({
  server: {
    // Braintrust authentication
    BRAINTRUST_API_KEY: z
      .string()
      .min(1)
      .describe("Braintrust API key for authentication"),
    BRAINTRUST_PROJECT_NAME: z
      .string()
      .min(1)
      .describe("Braintrust project name for organizing experiments"),

    // OpenTelemetry configuration
    OTEL_EXPORTER_OTLP_ENDPOINT: z
      .string()
      .url()
      .default("https://api.braintrust.dev/otel")
      .describe("OpenTelemetry endpoint for exporting traces"),
    OTEL_EXPORTER_OTLP_HEADERS: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Optional headers for OTLP exporter (e.g., authentication headers)",
      ),
  },

  runtimeEnv: {
    // These will be provided by the consuming application
    BRAINTRUST_API_KEY: process.env.BRAINTRUST_API_KEY,
    BRAINTRUST_PROJECT_NAME: process.env.BRAINTRUST_PROJECT_NAME,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
  },

  /**
   * Skip validation when explicitly requested (useful for dockerized builds)
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Treat empty strings as undefined to catch misconfigured env vars
   */
  emptyStringAsUndefined: true,
});

/**
 * Helper to get Braintrust configuration
 */
export function getBraintrustConfig() {
  return {
    apiKey: braintrustEnv.BRAINTRUST_API_KEY,
    projectName: braintrustEnv.BRAINTRUST_PROJECT_NAME,
  };
}

/**
 * Helper to get OpenTelemetry configuration
 */
export function getOtelConfig() {
  return {
    endpoint: braintrustEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: braintrustEnv.OTEL_EXPORTER_OTLP_HEADERS,
  };
}

/**
 * Check if OpenTelemetry is enabled
 */
export function isOtelEnabled(): boolean {
  return !!braintrustEnv.OTEL_EXPORTER_OTLP_HEADERS;
}
