import type { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";

import { EarlyAccessSkeleton } from "~/components/early-access/early-access-skeleton";
import { WaitlistCount } from "~/components/early-access/waitlist-count";
import { siteConfig } from "~/config/site";

// Enable streaming for this route
export const runtime = "edge";
export const revalidate = 0;

const EarlyAccessForm = dynamic(() =>
  import("~/components/early-access/early-access-form").then(
    (mod) => mod.EarlyAccessForm,
  ),
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
        <div className="w-full max-w-lg space-y-4">
          <Suspense fallback={<EarlyAccessSkeleton />}>
            <EarlyAccessForm />
          </Suspense>
        </div>
        <div className="flex h-8 items-center justify-center">
          <Suspense>
            <WaitlistCount />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
