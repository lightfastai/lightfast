"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

const providers = ["github", "vercel", "linear", "sentry"] as const;
export type Provider = (typeof providers)[number];

export function useConnectParams() {
  const [provider, setProvider] = useQueryState(
    "provider",
    parseAsStringLiteral(providers).withDefault("github").withOptions({
      shallow: true,
      history: "push",
    })
  );

  const [connected, setConnected] = useQueryState(
    "connected",
    parseAsStringLiteral(["true"] as const).withOptions({
      shallow: true,
    })
  );

  return {
    provider,
    setProvider,
    connected: connected === "true",
    clearConnected: () => setConnected(null),
  };
}
