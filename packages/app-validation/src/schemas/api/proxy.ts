import { z } from "zod";

// --- Proxy Search Response ---

export const ProxyEndpointSchema = z.object({
  endpointId: z
    .string()
    .describe("Unique identifier for this endpoint in the provider catalog"),
  method: z.enum(["GET", "POST"]).describe("HTTP method"),
  path: z.string().describe("URL path template with {param} placeholders"),
  description: z
    .string()
    .describe("Human-readable description of what this endpoint does"),
  pathParams: z
    .array(z.string())
    .optional()
    .describe("Path parameter names extracted from the path template"),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Custom timeout in milliseconds"),
});

export const ProxyConnectionSchema = z.object({
  installationId: z.string().describe("Gateway installation ID"),
  provider: z.string().describe("Provider name (e.g. github, linear, vercel)"),
  status: z.string().describe("Connection status"),
  baseUrl: z.string().describe("Provider API base URL"),
  endpoints: z
    .array(ProxyEndpointSchema)
    .describe("Available API endpoints for this provider"),
});

export const ProxySearchResponseSchema = z.object({
  connections: z
    .array(ProxyConnectionSchema)
    .describe("Connected providers and their available API endpoints"),
});

export type ProxyEndpoint = z.infer<typeof ProxyEndpointSchema>;
export type ProxyConnection = z.infer<typeof ProxyConnectionSchema>;
export type ProxySearchResponse = z.infer<typeof ProxySearchResponseSchema>;

// --- Proxy Execute ---

export const ProxyExecuteRequestSchema = z.object({
  installationId: z
    .string()
    .min(1)
    .describe("Gateway installation ID for the target connection"),
  endpointId: z
    .string()
    .min(1)
    .describe("Endpoint ID from the provider's API catalog"),
  pathParams: z
    .record(z.string(), z.string())
    .optional()
    .describe("Values for path template parameters (e.g. { owner: 'acme' })"),
  queryParams: z
    .record(z.string(), z.string())
    .optional()
    .describe("Query string parameters"),
  body: z.unknown().optional().describe("JSON request body"),
});

export const ProxyExecuteResponseSchema = z.object({
  status: z.number().int().describe("HTTP status code from the provider API"),
  data: z.unknown().describe("Response body from the provider API"),
  headers: z
    .record(z.string(), z.string())
    .describe("Response headers from the provider API"),
});

export type ProxyExecuteRequest = z.infer<typeof ProxyExecuteRequestSchema>;
export type ProxyExecuteResponse = z.infer<typeof ProxyExecuteResponseSchema>;
