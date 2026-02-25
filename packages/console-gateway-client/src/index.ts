import type { ProviderName } from "@repo/gateway-types";

export interface GatewayTokenResponse {
  accessToken: string;
  provider: string;
  expiresIn: number | null;
}

export interface GatewayConnectionResponse {
  id: string;
  provider: ProviderName;
  externalId: string;
  accountLogin: string | null;
  orgId: string;
  status: string;
  hasToken: boolean;
  tokenExpiresAt: string | null;
  resources: {
    id: string;
    providerResourceId: string;
    resourceName: string | null;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface GatewayLinkResourceResponse {
  status: string;
  resource: {
    id: string;
    providerResourceId: string;
    resourceName: string | null;
  };
}

export class GatewayClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async getToken(installationId: string): Promise<GatewayTokenResponse> {
    const res = await fetch(
      `${this.baseUrl}/connections/${installationId}/token`,
      { headers: { "X-API-Key": this.apiKey } },
    );
    if (!res.ok) {
      throw new Error(`Gateway token request failed: ${res.status}`);
    }
    return res.json() as Promise<GatewayTokenResponse>;
  }

  async getConnection(
    installationId: string,
  ): Promise<GatewayConnectionResponse> {
    const res = await fetch(
      `${this.baseUrl}/connections/${installationId}`,
      { headers: { "X-API-Key": this.apiKey } },
    );
    if (!res.ok) {
      throw new Error(`Gateway connection request failed: ${res.status}`);
    }
    return res.json() as Promise<GatewayConnectionResponse>;
  }

  async linkResource(
    installationId: string,
    providerResourceId: string,
    resourceName?: string,
  ): Promise<GatewayLinkResourceResponse> {
    const res = await fetch(
      `${this.baseUrl}/connections/${installationId}/resources`,
      {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ providerResourceId, resourceName }),
      },
    );
    if (!res.ok) {
      throw new Error(`Gateway link resource failed: ${res.status}`);
    }
    return res.json() as Promise<GatewayLinkResourceResponse>;
  }

  async unlinkResource(
    installationId: string,
    resourceId: string,
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/connections/${installationId}/resources/${resourceId}`,
      {
        method: "DELETE",
        headers: { "X-API-Key": this.apiKey },
      },
    );
    if (!res.ok) {
      throw new Error(`Gateway unlink resource failed: ${res.status}`);
    }
  }

  async deleteConnection(
    provider: string,
    installationId: string,
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/connections/${provider}/${installationId}`,
      {
        method: "DELETE",
        headers: { "X-API-Key": this.apiKey },
      },
    );
    if (!res.ok) {
      throw new Error(`Gateway delete connection failed: ${res.status}`);
    }
  }
}
