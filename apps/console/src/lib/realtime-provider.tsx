"use client";

import { RealtimeProvider } from "@upstash/realtime/client";

export function RealtimeProviderWrapper({ children }: { children: React.ReactNode }) {
  return <RealtimeProvider api={{ url: "/api/gateway/realtime", withCredentials: true }}>{children}</RealtimeProvider>;
}
