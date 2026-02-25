export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  raw: Record<string, unknown>;
}

export interface ProviderOptions {
  targetId?: string;
  scopes?: string[];
  redirectPath?: string;
}

export interface ConnectionProvider {
  readonly name: string;
  readonly requiresWebhookRegistration: boolean;

  // OAuth
  getAuthorizationUrl(state: string, options?: ProviderOptions): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

  // Webhook verification (Web Crypto only — no Node.js crypto)
  verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean>;
  extractDeliveryId(headers: Headers, payload: unknown): string;
  extractEventType(headers: Headers, payload: unknown): string;
  extractResourceId(payload: unknown): string | null;

  // Webhook registration (Linear, Sentry only)
  registerWebhook?(
    connectionId: string,
    callbackUrl: string,
    secret: string,
  ): Promise<string>;
  deregisterWebhook?(connectionId: string, webhookId: string): Promise<void>;
}
