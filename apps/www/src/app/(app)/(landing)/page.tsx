import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import dynamic from "next/dynamic";

import { EarlyAccessCountFallback } from "~/components/early-access/early-access-count-error";
import { EarlyAccessJotaiProvider } from "~/components/early-access/jotai/early-access-jotai-provider";
import { siteConfig } from "~/config/site";

// Preload the dynamic components to avoid navigation delays
const EarlyAccessForm = dynamic(
  () =>
    import("~/components/early-access/early-access-form").then(
      (mod) => mod.EarlyAccessForm,
    ),
  {
    ssr: true,
    loading: () => (
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted/30" />
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
          <span className="font-mono text-xs text-muted-foreground">
            Introducing
          </span>
          <h1 className="text-2xl font-semibold sm:text-3xl md:text-4xl">
            {siteConfig.name}{" "}
            <span className="gradient-text font-mono">Computer</span>
          </h1>
          <p className="mx-auto max-w-xs text-balance text-center text-xs text-muted-foreground sm:max-w-lg">
            Simplifying the way you integrate AI workflows into your day to day
            &#x2014; from design to development
          </p>
        </div>
        <div className="flex w-full max-w-lg flex-col gap-4">
          <EarlyAccessJotaiProvider>
            <Suspense
              fallback={
                <div className="h-10 w-full animate-pulse rounded-lg bg-muted/30" />
              }
            >
              <EarlyAccessForm />
            </Suspense>
            <div className="flex h-5 items-center justify-center">
              <ErrorBoundary errorComponent={EarlyAccessCountFallback}>
                <Suspense
                  fallback={
                    <div className="h-5 w-20 animate-pulse rounded-lg bg-muted/30" />
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
