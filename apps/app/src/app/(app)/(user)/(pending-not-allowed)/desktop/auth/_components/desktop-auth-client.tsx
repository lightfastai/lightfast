"use client";

import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

function validateLoopbackCallback(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:") return null;
    if (!LOOPBACK_HOSTS.has(parsed.hostname)) return null;
    if (parsed.pathname !== "/callback") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function DesktopAuthClient() {
  return (
    <ClientAuthBridge
      title="Authenticating…"
      subtitle="You'll be redirected back to the Lightfast desktop app shortly."
      jwtTemplate="lightfast-desktop"
      buildRedirectUrl={({ token, searchParams }) => {
        const state = searchParams.get("state");
        const callback = validateLoopbackCallback(searchParams.get("callback"));
        if (!state || !callback) return null;
        callback.searchParams.set("token", token);
        callback.searchParams.set("state", state);
        return callback.toString();
      }}
    />
  );
}
