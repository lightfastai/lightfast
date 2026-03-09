"use client";

import {
  createRealtime,
  RealtimeProvider,
} from "@vendor/upstash-realtime/client";
import type { RealtimeEvents } from "./index";

export const { useRealtime } = createRealtime<RealtimeEvents>();

export function RealtimeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RealtimeProvider
      api={{ url: "/api/gateway/realtime", withCredentials: true }}
    >
      {children}
    </RealtimeProvider>
  );
}
