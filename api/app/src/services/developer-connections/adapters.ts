import type {
  DeveloperConnectionConnectInput,
  DeveloperConnectionCredentialKind,
  DeveloperConnectionProvider,
} from "@repo/developer-connection-contract";

export interface VerifiedDeveloperCredential {
  credentialKind: DeveloperConnectionCredentialKind;
  credentialPayload: Record<string, unknown>;
  credentialSchemaVersion: "1";
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  providerAccountId: string | null;
  providerAccountName: string;
  scopes: string[];
}

export interface DeveloperConnectionMaterialization {
  env: Record<string, string>;
  files: Array<{ path: string; contents: string; mode: "0600" }>;
  provider: DeveloperConnectionProvider;
}

export async function verifyDeveloperConnectionInput(
  input: DeveloperConnectionConnectInput
): Promise<VerifiedDeveloperCredential> {
  const provider = input.provider;

  switch (provider) {
    case "pscale":
      return {
        credentialKind: "pscale_service_token",
        credentialSchemaVersion: "1",
        credentialPayload: {
          serviceTokenId: input.serviceTokenId,
          serviceToken: input.serviceToken,
        },
        providerAccountId: input.serviceTokenId,
        providerAccountName: input.providerAccountName,
        scopes: ["pscale:service-token"],
        metadata: {},
        expiresAt: null,
      };
    case "upstash":
      return {
        credentialKind: "upstash_management_key",
        credentialSchemaVersion: "1",
        credentialPayload: {
          email: input.email,
          apiKey: input.apiKey,
        },
        providerAccountId: input.email,
        providerAccountName: input.providerAccountName,
        scopes: ["upstash:management"],
        metadata: { email: input.email },
        expiresAt: null,
      };
    case "sentry":
      return {
        credentialKind: "sentry_token",
        credentialSchemaVersion: "1",
        credentialPayload: { token: input.token },
        providerAccountId: input.providerAccountName,
        providerAccountName: input.providerAccountName,
        scopes: ["sentry:token"],
        metadata: { authType: "token" },
        expiresAt: null,
      };
    case "clerk":
      return {
        credentialKind: "clerk_instance_secret",
        credentialSchemaVersion: "1",
        credentialPayload: {
          appId: input.appId,
          instanceId: input.instanceId,
          secretKey: input.secretKey,
        },
        providerAccountId: `${input.appId}:${input.instanceId}`,
        providerAccountName: input.providerAccountName,
        scopes: ["clerk:instance"],
        metadata: {
          appId: input.appId,
          instanceId: input.instanceId,
        },
        expiresAt: null,
      };
    default: {
      const unsupportedProvider: never = provider;
      throw new Error(
        `Unsupported developer connection provider: ${unsupportedProvider}`
      );
    }
  }
}

export function materializeDeveloperCredential(input: {
  provider: DeveloperConnectionProvider;
  credentialPayload: Record<string, unknown>;
}): DeveloperConnectionMaterialization {
  const provider = input.provider;

  switch (provider) {
    case "pscale":
      return {
        provider: "pscale",
        env: {
          PLANETSCALE_SERVICE_TOKEN_ID: String(
            input.credentialPayload.serviceTokenId
          ),
          PLANETSCALE_SERVICE_TOKEN: String(
            input.credentialPayload.serviceToken
          ),
        },
        files: [],
      };
    case "upstash": {
      const email = String(input.credentialPayload.email);
      const apiKey = String(input.credentialPayload.apiKey);
      return {
        provider: "upstash",
        env: {
          UPSTASH_EMAIL: email,
          UPSTASH_API_KEY: apiKey,
        },
        files: [
          {
            path: ".upstash.json",
            mode: "0600",
            contents: JSON.stringify({ email, apiKey }),
          },
        ],
      };
    }
    case "sentry":
      return {
        provider: "sentry",
        env: {
          SENTRY_AUTH_TOKEN: String(input.credentialPayload.token),
        },
        files: [],
      };
    case "clerk":
      return {
        provider: "clerk",
        env: {
          CLERK_SECRET_KEY: String(input.credentialPayload.secretKey),
        },
        files: [],
      };
    default: {
      const unsupportedProvider: never = provider;
      throw new Error(
        `Unsupported developer connection provider: ${unsupportedProvider}`
      );
    }
  }
}
