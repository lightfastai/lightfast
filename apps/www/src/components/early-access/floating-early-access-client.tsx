"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

import { EarlyAccessJotaiProvider } from "~/components/early-access/jotai/early-access-jotai-provider";

// Dynamic import with ssr: false is allowed in client components
const FloatingEarlyAccessChat = dynamic(
  () =>
    import("~/components/early-access/floating-early-access-chat").then(
      (mod) => mod.FloatingEarlyAccessChat,
    ),
  {
    ssr: false,
  },
);

export function FloatingEarlyAccessClient() {
  return (
    <EarlyAccessJotaiProvider>
      <Suspense fallback={null}>
        <FloatingEarlyAccessChat />
      </Suspense>
    </EarlyAccessJotaiProvider>
  );
}
