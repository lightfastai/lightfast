"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useState, type CSSProperties } from "react";

export function LandingExperience() {
  const [email, setEmail] = useState("");
  const canSubmit = email.trim().length > 0;

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

      <HeroContent
        canSubmit={canSubmit}
        email={email}
        onEmailChange={setEmail}
      />
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

function HeroContent({
  canSubmit,
  email,
  onEmailChange,
}: {
  canSubmit: boolean;
  email: string;
  onEmailChange: (email: string) => void;
}) {
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

        <form
          className="relative mt-[30.39px] w-full text-left"
          onSubmit={(event) => event.preventDefault()}
        >
          <label
            className="mb-[7.5px] block font-normal text-[16px] leading-6 tracking-normal [font-family:var(--font-geist-sans),system-ui,sans-serif]"
            htmlFor="landing-email"
          >
            Join the waitlist
          </label>

          <div className="relative h-12">
            <input
              className="h-12 w-full rounded-[8px] border border-[#edecec] bg-white px-5 pt-[8.96px] pr-14 pb-[9.28px] text-left text-[16px] text-neutral-900 leading-6 caret-neutral-900 outline-none transition-colors [font-family:var(--font-geist-sans),system-ui,sans-serif] placeholder:text-neutral-500 hover:bg-white focus:border-white focus:bg-white"
              id="landing-email"
              inputMode="email"
              name="email"
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="Enter your work email"
              required
              type="email"
              value={email}
            />
            <button
              aria-label="Join the waitlist"
              className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-[4px] bg-transparent text-white opacity-40 transition-[background-color,opacity,color] duration-200 enabled:bg-[#14120b] enabled:text-white enabled:opacity-100 disabled:pointer-events-none"
              disabled={!canSubmit}
              type="submit"
            >
              <ArrowRight
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.8}
              />
            </button>
          </div>
          <p className="mt-3 max-w-[520px] text-[#edecec]/75 text-xs leading-5">
            By joining, you agree to receive early access updates. See our{" "}
            <a className="underline underline-offset-2" href="/v2/legal/privacy">
              Privacy Policy
            </a>
            .
          </p>
        </form>
      </div>
    </section>
  );
}

function HalftoneBackground() {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className="absolute inset-0 z-0 hidden object-cover md:block"
      fill
      priority
      quality={100}
      sizes="100vw"
      src="/images/landing-halftone-bg.png"
    />
  );
}

function LightfastLockup() {
  return (
    <a
      aria-label="Lightfast home"
      className="inline-flex h-10 items-center gap-[8.75px] text-[#edecec] opacity-100 transition-opacity duration-200 ease-out hover:opacity-70"
      href="/v2"
    >
      <DotMatrixMark className="size-[31.3px]" />
      <span
        className="flex h-10 items-center font-medium text-[33.45px] leading-10 tracking-normal [font-family:var(--font-roobert-trial),system-ui,sans-serif]"
        style={{
          fontFeatureSettings: '"ss01", "ss04", "ss06", "ss11", "ss14"',
        }}
      >
        Lightfast
      </span>
    </a>
  );
}

function DotMatrixMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M8 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M8 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0"
        fill="currentColor"
      />
    </svg>
  );
}
