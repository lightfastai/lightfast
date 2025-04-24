import type { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";

import { AiNodeCreatorSkeleton } from "~/components/ai-node-creator/ai-node-creator-skeleton";
import { siteConfig } from "~/config/site";

const EarlyAccessForm = dynamic(() =>
  import("~/components/early-access/early-access-form").then(
    (mod) => mod.EarlyAccessForm,
  ),
);

const AiNodeCreator = dynamic(() =>
  import("~/components/ai-node-creator/ai-node-creator").then(
    (mod) => mod.AiNodeCreator,
  ),
);

export const metadata: Metadata = {
  title: "Home",
  description: "Join the waitlist to get early access to Lightfast",
};

export default function Home() {
  return (
    <div className="flex flex-col items-center px-4 pt-16 sm:pt-24 md:pt-32">
      <div className="flex w-full flex-col items-center justify-center gap-3 py-4 sm:gap-4">
        <span className="font-mono text-xs text-muted-foreground">
          Introducing
        </span>{" "}
        <h1 className="text-center text-2xl font-semibold sm:text-3xl md:text-4xl">
          {siteConfig.name}{" "}
          <span className="gradient-text font-mono">Computer</span>
        </h1>
        <p className="max-w-xs text-balance text-center text-xs text-muted-foreground sm:max-w-lg">
          Simplifying the way you integrate AI workflows into your day to day
          &#x2014; from design to development
        </p>
      </div>
      <div className="flex w-full flex-col items-center justify-center py-4">
        <div className="w-full max-w-lg space-y-4 px-4 sm:px-0">
          <EarlyAccessForm />
        </div>
      </div>

      <div className="my-4 w-full max-w-3xl px-4 sm:my-8 sm:px-6 lg:px-8">
        <Suspense fallback={<AiNodeCreatorSkeleton />}>
          <AiNodeCreator />
        </Suspense>
      </div>
    </div>
  );
}
