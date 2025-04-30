import type {
  ClerkAPIError,
  CredentialReturn,
  PublicKeyCredentialCreationOptionsWithoutExtensions,
  PublicKeyCredentialRequestOptionsWithoutExtensions,
  PublicKeyCredentialWithAuthenticatorAssertionResponse,
  PublicKeyCredentialWithAuthenticatorAttestationResponse,
} from "@clerk/types";

export interface TokenCache {
  getToken: (key: string) => Promise<string | undefined | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
}

interface ClerkError {
  errors: ClerkAPIError[];
  clerkError: boolean;
}

export type BuildClerkOptions = {
  publishableKey?: string;
  tokenCache?: TokenCache;
  /**
   * Note: Passkey support in Expo is currently in a limited rollout phase.
   * If you're interested in using this feature, please contact us for early access or additional details.
   *
   * @experimental This API is experimental and may change at any moment.
   */
  __experimental_passkeys?: {
    get: ({
      publicKeyOptions,
    }: {
      publicKeyOptions: PublicKeyCredentialRequestOptionsWithoutExtensions;
    }) => Promise<
      CredentialReturn<PublicKeyCredentialWithAuthenticatorAssertionResponse>
    >;
    create: (
      publicKeyCredential: PublicKeyCredentialCreationOptionsWithoutExtensions,
    ) => Promise<
      CredentialReturn<PublicKeyCredentialWithAuthenticatorAttestationResponse>
    >;
    isSupported: () => boolean;
    isAutoFillSupported: () => Promise<boolean>;
  };
};
