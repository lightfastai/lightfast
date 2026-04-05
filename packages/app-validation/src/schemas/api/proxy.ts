import { z } from "zod";

// --- Proxy Search Response ---

export const ProxyActionSchema = z.object({
  action: z
    .string()
    .describe("Action identifier (e.g. github.list-pull-requests)"),
  params: z.array(z.string()).optional().describe("Required parameter names"),
  description: z.string().describe("What this action does"),
});

export const ProxyResourceSchema = z.object({
  name: z.string().describe("Human-readable resource name (e.g. acme/web)"),
  params: z
    .record(z.string(), z.string())
    .describe("Pre-computed params for action calls"),
  syncing: z
    .array(z.string())
    .optional()
    .describe("Event types being synced to Lightfast"),
});

export const ProxyConnectionSchema = z.object({
  id: z.string().describe("Connection ID"),
  provider: z.string().describe("Provider name (e.g. github, linear, vercel)"),
  resources: z
    .array(ProxyResourceSchema)
    .describe("Connected resources with pre-computed action params"),
  actions: z
    .array(ProxyActionSchema)
    .describe("Available actions for this provider"),
});

export const ProxySearchResponseSchema = z.object({
  connections: z
    .array(ProxyConnectionSchema)
    .describe("Connected providers with resources and available actions"),
});

// --- Proxy Call ---

export const ProxyCallSchema = z.object({
  action: z
    .string()
    .min(1)
    .describe("Action to execute (e.g. github.list-pull-requests)"),
  params: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Action parameters — spread resource params and add extras"),
  connection: z
    .string()
    .optional()
    .describe("Connection ID (optional, for future multi-connection support)"),
});

export const ProxyCallResponseSchema = z.object({
  status: z.number().int().describe("HTTP status code from the provider API"),
  data: z.unknown().describe("Response body from the provider API"),
  headers: z
    .record(z.string(), z.string())
    .describe("Response headers from the provider API"),
});

// --- Types ---

export type ProxyAction = z.infer<typeof ProxyActionSchema>;
export type ProxyResource = z.infer<typeof ProxyResourceSchema>;
export type ProxyConnection = z.infer<typeof ProxyConnectionSchema>;
export type ProxySearchResponse = z.infer<typeof ProxySearchResponseSchema>;
export type ProxyCall = z.infer<typeof ProxyCallSchema>;
export type ProxyCallResponse = z.infer<typeof ProxyCallResponseSchema>;
