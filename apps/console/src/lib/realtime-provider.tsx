"use client";

import { RealtimeProvider } from "@upstash/realtime/client";

export function RealtimeProviderWrapper({ children }: { children: React.ReactNode }) {
  return <RealtimeProvider api={{ withCredentials: true }}>{children}</RealtimeProvider>;
}
