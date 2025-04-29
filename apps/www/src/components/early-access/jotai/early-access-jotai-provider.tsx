"use client";

import { Provider as JotaiProvider } from "jotai";

export function EarlyAccessJotaiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <JotaiProvider>{children}</JotaiProvider>;
}
