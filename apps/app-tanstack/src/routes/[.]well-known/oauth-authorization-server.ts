import { MCP_SUPPORTED_SCOPES } from "@api/app";
import { createFileRoute } from "@tanstack/react-router";
import { oauthJson, oauthUrl } from "~/server/oauth/mcp-response";

export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        GET: async () => {
          const issuer = oauthUrl("");
          return oauthJson({
            authorization_endpoint: oauthUrl("/oauth/authorize"),
            code_challenge_methods_supported: ["S256"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            issuer,
            jwks_uri: oauthUrl("/oauth/jwks"),
            registration_endpoint: oauthUrl("/oauth/register"),
            response_types_supported: ["code"],
            revocation_endpoint: oauthUrl("/oauth/revoke"),
            scopes_supported: MCP_SUPPORTED_SCOPES,
            token_endpoint: oauthUrl("/oauth/token"),
            token_endpoint_auth_methods_supported: ["none"],
          });
        },
      },
    },
  }
);
