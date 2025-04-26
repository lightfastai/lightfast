import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import dynamic from "next/dynamic";

import { EarlyAccessCountFallback } from "~/components/early-access/early-access-count-error";
import { EarlyAccessCountServer } from "~/components/early-access/early-access-count-server";
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
      <div className="bg-muted/30 h-10 w-full animate-pulse rounded-lg" />
    ),
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
          <h1 className="py-2 text-2xl font-semibold sm:text-3xl md:text-4xl">
            <span className="">{siteConfig.name}</span>{" "}
            <span className="relative inline-block bg-gradient-to-r from-sky-400 via-fuchsia-400 to-orange-400 bg-clip-text font-mono text-transparent">
              Computer
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xs text-center text-xs text-balance sm:max-w-lg">
            Simplifying the way you integrate AI workflows into your day to day
            &#x2014; from design to development
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
                <Suspense>
                  <EarlyAccessCountServer />
                </Suspense>
              </ErrorBoundary>
            </div>
          </EarlyAccessJotaiProvider>
        </div>
      </div>
    </div>
  );
}
