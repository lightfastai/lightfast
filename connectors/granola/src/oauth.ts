import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthTokens,
} from "@vendor/mcp";

export interface GranolaOAuthClientProviderSnapshot {
  clientInformation?: OAuthClientInformationMixed;
  codeVerifier?: string;
  tokens?: OAuthTokens;
}

export interface GranolaOAuthClientProviderInput {
  clientInformation?: OAuthClientInformationMixed;
  clientMetadata: OAuthClientMetadata;
  codeVerifier?: string;
  onAuthorizationUrl?: (authorizationUrl: URL) => void | Promise<void>;
  redirectUrl: string | URL;
  tokens?: OAuthTokens;
}

export class GranolaOAuthClientProvider implements OAuthClientProvider {
  readonly #clientMetadata: OAuthClientMetadata;
  readonly #onAuthorizationUrl?: (
    authorizationUrl: URL
  ) => void | Promise<void>;
  readonly #redirectUrl: string | URL;
  #clientInformation?: OAuthClientInformationMixed;
  #codeVerifier?: string;
  #tokens?: OAuthTokens;

  constructor(input: GranolaOAuthClientProviderInput) {
    this.#clientInformation = input.clientInformation;
    this.#clientMetadata = input.clientMetadata;
    this.#codeVerifier = input.codeVerifier;
    this.#onAuthorizationUrl = input.onAuthorizationUrl;
    this.#redirectUrl = input.redirectUrl;
    this.#tokens = input.tokens;
  }

  get redirectUrl(): string | URL {
    return this.#redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return this.#clientMetadata;
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.#clientInformation;
  }

  saveClientInformation(clientInformation: OAuthClientInformationMixed): void {
    this.#clientInformation = clientInformation;
  }

  tokens(): OAuthTokens | undefined {
    return this.#tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this.#tokens = tokens;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.#onAuthorizationUrl?.(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.#codeVerifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this.#codeVerifier) {
      throw new Error("No code verifier saved.");
    }
    return this.#codeVerifier;
  }

  invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery"
  ): void {
    switch (scope) {
      case "all":
        this.#clientInformation = undefined;
        this.#codeVerifier = undefined;
        this.#tokens = undefined;
        break;
      case "client":
        this.#clientInformation = undefined;
        break;
      case "tokens":
        this.#tokens = undefined;
        break;
      case "verifier":
        this.#codeVerifier = undefined;
        break;
      case "discovery":
        break;
      default: {
        const unreachable: never = scope;
        throw new Error(
          `Unsupported credential invalidation scope: ${unreachable}`
        );
      }
    }
  }

  snapshot(): GranolaOAuthClientProviderSnapshot {
    return {
      clientInformation: this.#clientInformation,
      codeVerifier: this.#codeVerifier,
      tokens: this.#tokens,
    };
  }
}
