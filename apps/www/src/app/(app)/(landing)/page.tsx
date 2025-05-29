import type { Metadata } from "next";
import Image from "next/image";

import { Icons } from "@repo/ui/components/icons";
import { Container } from "@repo/ui/components/ui/container";

import { FloatingEarlyAccessClient } from "~/components/early-access/floating-early-access-client";

export const metadata: Metadata = {
  title: "Home",
  description: "Join the waitlist to get early access to Lightfast",
};

export default function Home() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* Pre-container section */}
      <div className="flex items-center justify-center px-4 pb-8">
        <div className="flex flex-col items-center gap-6 sm:gap-8">
          <span className="text-muted-foreground font-mono text-xs font-medium">
            Introducing
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Icons.logo className="w-30" />
            <span className="bg-gradient-to-r from-sky-200 to-sky-500 bg-clip-text text-lg font-medium tracking-widest text-transparent uppercase">
              Computer
            </span>
          </div>

          {/* Static description */}
          <div className="max-w-2xl px-4">
            <p className="text-muted-foreground text-center text-sm text-balance sm:text-base">
              The intelligent creative copilot that simplifies the way you
              interact with applications like Blender, Unity, Fusion360 and
              more.
            </p>
          </div>
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

      {/* Floating Early Access Chat */}
      <FloatingEarlyAccessClient />
    </div>
  );
}
