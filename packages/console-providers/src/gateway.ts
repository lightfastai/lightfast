/**
 * Gateway API Response Schemas
 *
 * Response shapes for the gateway service HTTP API.
 * Consumed exclusively by packages/gateway-service-clients.
 */

import { z } from "zod";

/**
 * Gateway connection response shape.
 * Returned by GET /gateway/:id
 */
export const gatewayConnectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string(),
  orgId: z.string(),
  status: z.string(),
  resources: z.array(
    z.object({
      id: z.string(),
      providerResourceId: z.string(),
      resourceName: z.string().nullable(),
    })
  ),
});
export type GatewayConnection = z.infer<typeof gatewayConnectionSchema>;

/**
 * Gateway token response shape.
 * Returned by GET /gateway/:id/token
 */
export const gatewayTokenResultSchema = z.object({
  accessToken: z.string(),
  provider: z.string(),
  expiresIn: z.number().nullable(),
});
export type GatewayTokenResult = z.infer<typeof gatewayTokenResultSchema>;

/**
 * Gateway proxy endpoints response shape.
 * Returned by GET /gateway/:id/proxy/endpoints
 */
export const proxyEndpointsResponseSchema = z.object({
  provider: z.string(),
  baseUrl: z.string(),
  endpoints: z.record(
    z.string(),
    z.object({
      method: z.enum(["GET", "POST"]),
      path: z.string(),
      description: z.string(),
      timeout: z.number().optional(),
    })
  ),
});
export type ProxyEndpointsResponse = z.infer<
  typeof proxyEndpointsResponseSchema
>;
