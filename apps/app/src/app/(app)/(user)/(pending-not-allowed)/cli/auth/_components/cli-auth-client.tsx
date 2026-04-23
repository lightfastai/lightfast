"use client";

import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

export function CLIAuthClient() {
  return (
    <ClientAuthBridge
      title="Authenticating…"
      subtitle="You'll be redirected back to the CLI shortly."
      buildRedirectUrl={({ token, searchParams }) => {
        const port = searchParams.get("port");
        const state = searchParams.get("state");
        if (!port || !state) return null;
        const portNum = Number.parseInt(port, 10);
        if (!Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
          return null;
        }
        return `http://localhost:${portNum}/callback?token=${encodeURIComponent(
          token
        )}&state=${encodeURIComponent(state)}`;
      }}
    />
  );
}
