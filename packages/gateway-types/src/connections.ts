/**
 * Gateway connection response shape.
 * Returned by GET /gateway/:id
 */
export interface GatewayConnection {
  id: string;
  provider: string;
  externalId: string;
  orgId: string;
  status: string;
  resources: {
    id: string;
    providerResourceId: string;
    resourceName: string | null;
  }[];
}

/**
 * Gateway token response shape.
 * Returned by GET /gateway/:id/token
 */
export interface GatewayTokenResult {
  accessToken: string;
  provider: string;
  expiresIn: number | null;
}
