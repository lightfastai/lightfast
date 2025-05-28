import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import dynamic from "next/dynamic";
import Image from "next/image";

import { Icons } from "@repo/ui/components/icons";
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
      {/* Pre-container section */}
      <div className="flex items-center justify-center px-4 pb-2">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <span className="text-muted-foreground font-mono text-xs font-medium">
            Introducing
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Icons.logo className="w-30" />
            <span className="bg-gradient-to-r from-sky-200 to-sky-500 bg-clip-text text-lg font-medium tracking-widest text-transparent uppercase">
              Computer
            </span>
          </div>
          <div className="max-w-2xl px-4">
            <p className="text-muted-foreground text-center text-xs text-balance sm:text-sm">
              Simplifying the way you interact with applications like Blender,
              Unity, Fusion360 and more. We integrate with your tools to make
              your workflow more efficient.
            </p>
          </div>
        </div>
      </div>

      {/* Early Access Form Section */}
      <div className="flex flex-col items-center gap-4 px-4 pt-2 pb-6 sm:pt-4 sm:pb-8">
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

      {/* Main container with blue sky background */}
      <Container className="relative mt-12 mb-8 overflow-hidden rounded-lg sm:mb-12">
        {/* Background gradient */}
        <div className="absolute inset-0 z-0 rounded-lg border bg-gradient-to-br from-sky-200 via-sky-300 to-sky-500">
          <Image
            src="/blue-sky.0.png"
            alt="Blue sky gradient background"
            className="h-full w-full rounded-md object-cover object-center"
            width={1376}
            height={895}
            priority
            loading="eager"
            quality={70}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
          />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex h-full min-h-[50vh] flex-col items-center justify-center px-4 py-24 sm:min-h-[60vh] sm:py-32 md:py-48 lg:py-64">
          {/* White div with "Copilot for Creatives" */}
          <div className="rounded-lg bg-white px-4 py-3 shadow-lg sm:px-6 sm:py-4 md:px-8 md:py-6">
            <h1 className="text-sm text-black sm:text-base md:text-lg lg:text-xl">
              We are building the{" "}
              <span className="font-bold">Copilot for Creatives</span>
            </h1>
          </div>
        </div>
      </Container>

      {/* Integrated with section in its own Container, not over the bg gradient */}
      <Container className="relative">
        <section
          className="bg-background/80 flex min-h-[40vh] w-full flex-col items-center justify-center px-4 py-12 sm:min-h-[50vh] sm:py-16"
          aria-label="Integrated with popular creative apps"
        >
          <h2 className="mb-6 text-center font-mono text-xs font-semibold tracking-widest uppercase sm:mb-8 sm:text-sm">
            Integrated with
          </h2>
          <ul className="grid w-full max-w-4xl grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4 md:gap-12">
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
                  className="h-auto w-24 sm:w-28 md:w-36 lg:w-40"
                  sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, (max-width: 1024px) 144px, 160px"
                />
              </li>
            ))}
          </ul>
        </section>
      </Container>

      {/* Automation section */}
      {/* <Container className="relative">
        <section
          className="border-border bg-background/80 relative mt-12 flex min-h-[40vh] w-full flex-col items-center justify-center overflow-hidden rounded-lg border pb-12"
          aria-label="Single interface to automate your creative needs"
        >
          <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
            <Image
              src="/automation-section-bg.png"
              alt="Gradient"
              className="h-full w-full grayscale filter"
              width={1376}
              height={895}
              priority={false}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-black/50 backdrop-blur-sm" />
          <div className="relative z-20 flex h-full w-full flex-col items-center justify-center">
            <div className="border-border flex h-8 w-full items-center justify-end gap-2 px-4">
              <div className="text-foreground flex items-center gap-4 text-xs">
                <Wifi className="h-4 w-4" />
                <CurrentTime />
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex max-w-2xl flex-col items-center gap-4">
                <h2 className="text-center text-2xl font-semibold">
                  An intelligent Creative Copilot
                </h2>
                <p className="text-muted-foreground mb-6 text-center text-sm">
                  Lightfast is an intelligent creative copilot that simplifies
                  the way you interact with applications like Blender, Unity,
                  Fusion360 and more.
                </p>
              </div>
              <div
                className="flex items-center justify-center gap-2"
                aria-label="Powered by OpenAI"
              >
                <span className="sr-only">Powered by OpenAI</span>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <g>
                    <path
                      d="M16.001 2.667c-3.68 0-6.667 2.987-6.667 6.667v1.333h-1.334C4.987 10.667 2 13.653 2 17.333c0 3.68 2.987 6.667 6.667 6.667h1.333v1.333c0 3.68 2.987 6.667 6.667 6.667 3.68 0 6.667-2.987 6.667-6.667v-1.333h1.333c3.68 0 6.667-2.987 6.667-6.667 0-3.68-2.987-6.667-6.667-6.667h-1.333V9.334c0-3.68-2.987-6.667-6.667-6.667zm0 2c2.577 0 4.667 2.09 4.667 4.667v1.333h-9.334V9.334c0-2.577 2.09-4.667 4.667-4.667zm-6.667 6.667h13.334c2.577 0 4.667 2.09 4.667 4.667 0 2.577-2.09 4.667-4.667 4.667H9.334c-2.577 0-4.667-2.09-4.667-4.667 0-2.577 2.09-4.667 4.667-4.667zm0 13.334c-2.577 0-4.667-2.09-4.667-4.667 0-2.577 2.09-4.667 4.667-4.667h13.334c2.577 0 4.667 2.09 4.667 4.667 0 2.577-2.09 4.667-4.667 4.667H9.334zm6.667 6.666c-2.577 0-4.667-2.09-4.667-4.666v-1.334h9.334v1.334c0 2.576-2.09 4.666-4.667 4.666z"
                      fill="#10A37F"
                    />
                  </g>
                </svg>
                <span className="text-muted-foreground text-xs font-medium">
                  Powered by OpenAI
                </span>
              </div>
            </div>
            <div className="bg-muted flex w-full max-w-4xl flex-col items-center gap-8 border p-12 px-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 text-center md:text-left">
                <p className="text-primary mb-4 text-base md:text-xl">
                  Orchestrate, script, and automate tasks across your favorite
                  creative tools from one unified interface. Lightfast empowers
                  you to streamline your workflow, save time, and focus on what
                  matters most: creating.
                </p>
              </div>
              <div className="flex flex-1 justify-center">
                <Image
                  src="/images/playground-placeholder-1.webp"
                  alt="Automation example"
                  width={400}
                  height={225}
                  className="rounded-lg object-cover shadow-lg"
                  priority={false}
                />
              </div>
            </div>
          </div>
        </section>
      </Container> */}
    </div>
  );
}
