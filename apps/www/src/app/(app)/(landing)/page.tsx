import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import dynamic from "next/dynamic";

import { Icons } from "@repo/ui/components/icons";

import { EarlyAccessCountFallback } from "~/components/early-access/early-access-count-error";
import { EarlyAccessJotaiProvider } from "~/components/early-access/jotai/early-access-jotai-provider";

// Preload the dynamic components to avoid navigation delays
const EarlyAccessForm = dynamic(
  () =>
    import("~/components/early-access/early-access-form").then(
      (mod) => mod.EarlyAccessForm,
    ),
  {
    ssr: true,
    loading: () => (
      <div className="bg-muted/30 h-10 w-full animate-pulse rounded-lg" />
    ),
  },
);

const EarlyAccessCount = dynamic(
  () =>
    import("~/components/early-access/early-access-count").then(
      (mod) => mod.EarlyAccessCount,
    ),
  {
    ssr: true,
    loading: () => <EarlyAccessCountFallback />,
  },
);

export const metadata: Metadata = {
  title: "Home",
  description: "Join the waitlist to get early access to Lightfast",
};

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
        <div className="space-y-4">
          <span className="text-muted-foreground font-mono text-xs">
            Introducing
          </span>
          <h1 className="text-md text-md flex items-center justify-center gap-2 py-2 leading-none font-bold tracking-[0.1em] uppercase lg:text-xl">
            <Icons.logo className="w-26 lg:w-32" />
            <span className="relative inline-block bg-gradient-to-r from-sky-400 via-fuchsia-400 to-orange-400 bg-clip-text text-transparent">
              Computer
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xs text-center text-xs text-balance sm:max-w-lg">
            Simplifying the way you interact with applications like Blender,
            Unity, Fusion360 and more. We integrate with your tools to make your
            workflow more efficient.
          </p>
        </div>
        <div className="flex w-full max-w-[320px] flex-col gap-2 sm:max-w-md md:max-w-lg">
          <EarlyAccessJotaiProvider>
            <Suspense
              fallback={
                <div className="bg-muted/30 h-10 w-full animate-pulse rounded-lg" />
              }
            >
              <EarlyAccessForm />
            </Suspense>
            <div className="flex h-5 items-center justify-center">
              <ErrorBoundary errorComponent={EarlyAccessCountFallback}>
                <Suspense
                  fallback={
                    <div className="bg-muted/30 h-5 w-20 animate-pulse rounded-lg" />
                  }
                >
                  <EarlyAccessCount />
                </Suspense>
              </ErrorBoundary>
            </div>
          </EarlyAccessJotaiProvider>
        </div>
      </div>
    </div>
  );
}
