import type { McpScope } from "@repo/api-contract";

export interface McpConsentViewModel {
  client: {
    id: string;
    name: string;
    redirectUri: string;
    verified: boolean;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  permissions: Array<{
    description: string;
    kind: "read" | "write";
    label: string;
    scope: McpScope;
  }>;
  request: {
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    redirectUri: string;
    resource: string;
    scope: string;
    state?: string;
  };
  user: {
    email: string;
    id: string;
    name: string;
  };
}

export interface McpAuthorizationInput {
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  organizationId: string;
  redirectUri: string;
  resource: string;
  scope?: string;
  state?: string;
}
