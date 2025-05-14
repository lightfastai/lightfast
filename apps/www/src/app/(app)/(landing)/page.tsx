import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import dynamic from "next/dynamic";
import Image from "next/image";

import { Container } from "@repo/ui/components/ui/container";

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
    <div className="relative min-h-screen w-full">
      {/* Background container */}
      <Container>
        <div className="relative">
          {/* Dynamic background gradient */}
          <div className="absolute top-[5vh] left-1/2 z-0 h-[calc(100vh-10rem)] w-full -translate-x-1/2 overflow-hidden rounded-xl">
            {/* <BackgroundGradient className="h-full w-full" /> */}
            <Image
              src="/bg-gradient.png"
              alt="Gradient"
              className="h-full w-full object-cover"
              fill
            />
          </div>
        </div>
      </Container>

      {/* Main content container */}
      <Container className="relative z-10">
        <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center gap-8 text-center">
            {/* Main heading */}
            <h1 className="text-4xl font-semibold sm:text-5xl md:text-6xl lg:text-8xl">
              Copilot for Creatives
            </h1>

            {/* Description */}
            <div className="max-w-2xl space-y-4">
              <p className="text-primary text-center text-base text-balance md:text-lg">
                Simplifying the way you interact with applications like Blender,
                Unity, Fusion360 and more.
              </p>
            </div>

            {/* Form section */}
            <div className="mt-6 flex w-full max-w-md flex-col gap-2">
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
      </Container>
    </div>
  );
}
