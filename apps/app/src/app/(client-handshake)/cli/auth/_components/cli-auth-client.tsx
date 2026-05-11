"use client";

import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

// CLI retains the GET ?token= redirect handoff. Desktop moved to POST in
// Phase 2 of the PR #614 follow-up; the CLI side can migrate later when its
// loopback server adds POST support.
export function CLIAuthClient() {
  return (
    <ClientAuthBridge
      buildRedirectUrl={({ token, searchParams }) => {
        const port = searchParams.get("port");
        const state = searchParams.get("state");
        if (!(port && state)) {
          return null;
        }
        const portNum = Number.parseInt(port, 10);
        if (!Number.isInteger(portNum) || portNum < 1024 || portNum > 65_535) {
          return null;
        }
        return `http://localhost:${portNum}/callback?token=${encodeURIComponent(
          token
        )}&state=${encodeURIComponent(state)}`;
      }}
      mode="redirect"
      subtitle="You'll be redirected back to the CLI shortly."
      title="Authenticating…"
    />
  );
}
