"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const canSubmit = email.trim().length > 0;

  return (
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
          onChange={(event) => setEmail(event.target.value)}
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
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={ArrowRight01Icon}
            strokeWidth={1.8}
          />
        </button>
      </div>
      <p className="mt-3 max-w-[520px] text-[#edecec]/75 text-xs leading-5">
        By joining, you agree to receive early access updates. See our{" "}
        <Link className="underline underline-offset-2" href="/legal/privacy">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
