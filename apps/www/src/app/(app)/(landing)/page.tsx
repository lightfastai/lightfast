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
    <div className="relative w-full overflow-hidden">
      <Container className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
          <Image
            src="/bg-gradient.png"
            alt="Gradient"
            className="h-full w-full object-cover"
            fill
          />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-between">
          {/* Hero section */}
          <div className="flex flex-col items-center justify-center gap-5 pt-16 text-center">
            {/* Main heading */}
            <h1 className="text-4xl font-semibold sm:text-5xl md:text-6xl lg:text-8xl">
              Copilot for Creatives
            </h1>

            {/* Description and form wrapper */}
            <div className="flex flex-col items-center gap-4 pt-8">
              {/* Description */}
              <div className="max-w-4xl">
                <p className="text-primary text-center text-base text-balance md:text-xl">
                  Simplifying the way you interact with applications like
                  Blender, Unity, Fusion360 and more.
                </p>
              </div>

              {/* Form section */}
              <div className="mt-3 flex w-full max-w-md flex-col gap-2">
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

          {/* Application example image */}
          <div className="flex w-full justify-center pt-16">
            <div className="border-border relative aspect-video w-full max-w-4xl overflow-hidden rounded-t-lg border-x border-t shadow-lg">
              <Image
                src="/app-example.png"
                alt="Lightfast application example"
                fill
                className="bg-muted object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </Container>

      {/* Integrated with section in its own Container, not over the bg gradient */}
      <Container className="relative">
        <section
          className="bg-background/80 mt-12 flex h-[50vh] w-full flex-col items-center justify-center"
          aria-label="Integrated with popular creative apps"
        >
          <h2 className="mb-8 text-center font-mono text-xs font-semibold tracking-widest uppercase">
            Integrated with
          </h2>
          <ul className="grid w-full max-w-4xl grid-cols-2 gap-12 px-4 sm:grid-cols-3 md:grid-cols-4">
            {[
              {
                title: "Blender",
                image: "/creative-app-logos/blender.png",
              },
              {
                title: "TouchDesigner",
                image: "/creative-app-logos/touchdesigner.png",
              },
              {
                title: "Houdini",
                image: "/creative-app-logos/houdini.png",
              },
              {
                title: "Unreal Engine",
                image: "/creative-app-logos/unreal-engine.png",
              },
            ].map((app) => (
              <li key={app.title} className="flex items-center justify-center">
                <Image
                  src={app.image}
                  alt={app.title}
                  width={200}
                  height={200}
                />
              </li>
            ))}
          </ul>
        </section>
      </Container>
    </div>
  );
}
