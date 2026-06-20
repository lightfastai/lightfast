import { Logo } from "@repo/ui-v2/components/brand/logo";
import type { CSSProperties } from "react";

import { WaitlistForm } from "./waitlist-form";

export function LandingExperience() {
  return (
    <main
      className="relative h-svh min-h-[640px] overflow-hidden bg-[#14120b] text-[#edecec] [font-family:var(--font-geist-sans),system-ui,sans-serif] selection:bg-[#14120b] selection:text-[#edecec] max-lg:min-h-svh"
      style={
        {
          "--guide-x": "24.58%",
          "--guide-y": "clamp(108px, calc(45.9svh - 180px), 27.55%)",
        } as CSSProperties
      }
    >
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#1d3d56_0%,#6e9aaa_48%,#060c09_100%)] md:hidden" />
      <HalftoneBackground />
      <div className="absolute inset-0 z-[1] bg-black/20 lg:bg-black/25" />
      <DecorativeGuides />

      <HeroContent />
    </main>
  );
}

function DecorativeGuides() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-[var(--guide-y)] h-px bg-white/10" />
      <div className="absolute top-0 bottom-0 left-[var(--guide-x)] w-px bg-white/10" />
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        <path
          d="M175 -8 C128 206 116 548 275 748 C432 945 806 833 1448 368"
          stroke="rgba(255,255,255,0.82)"
          strokeWidth="1.1"
        />
        <path
          d="M1160 -2 L1446 280"
          stroke="rgba(255,255,255,0.86)"
          strokeDasharray="6 8"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}

function HeroContent() {
  return (
    <section className="relative z-10 grid min-h-full w-full grid-cols-2 grid-rows-[auto_1fr] gap-4 p-6 md:grid-cols-4 lg:grid-rows-[1fr_auto_1fr] lg:gap-6">
      <div className="col-span-2 row-start-1 flex w-full flex-col items-start self-start text-left md:col-span-2 lg:col-start-2 lg:row-start-2 lg:self-center">
        <LightfastLockup />

        <h1 className="mt-[38.39px] w-full max-w-[684px] text-balance pr-10 font-medium text-[52px] leading-[1.1em] tracking-normal [font-family:var(--font-pp-neue-montreal),system-ui,sans-serif] max-sm:pr-0 max-sm:text-[44px]">
          A git forge for
          <br />
          the agentic era
        </h1>

        <p className="mt-[15.2px] w-[520px] max-w-full font-normal text-[16px] leading-6 tracking-normal [font-family:var(--font-geist-sans),system-ui,sans-serif]">
          Code is moving faster than any infrastructure was built to handle.
          <br />
          Origin was designed for this moment.
        </p>

        <WaitlistForm />
      </div>
    </section>
  );
}

function HalftoneBackground() {
  return (
    <picture
      aria-hidden="true"
      className="absolute inset-0 z-0 hidden md:block"
    >
      <source
        media="(min-width: 768px)"
        srcSet="/images/landing-halftone-bg-q40.avif"
        type="image/avif"
      />
      <source
        media="(min-width: 768px)"
        srcSet="/images/landing-halftone-bg-q40.webp"
        type="image/webp"
      />
      <img
        alt=""
        className="h-full w-full object-cover"
        decoding="async"
        fetchPriority="high"
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
      />
    </picture>
  );
}

function LightfastLockup() {
  return (
    <a
      aria-label="Lightfast home"
      className="inline-flex h-10 items-center gap-[8.75px] text-[#edecec] opacity-100 transition-opacity duration-200 ease-out hover:opacity-70"
      href="/"
    >
      <Logo className="text-[#edecec]" size="md" />
    </a>
  );
}
