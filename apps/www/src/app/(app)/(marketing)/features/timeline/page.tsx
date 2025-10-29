import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Timeline",
  description: "Lightfast Timeline. Stay tuned for updates.",
  alternates: {
    canonical: "https://lightfast.ai/features/timeline",
  },
});

export default function TimelinePage() {
  return (
    <>
      <h1 className={`text-6xl font-light leading-[1.2] tracking-[-0.7] text-foreground mb-8 ${exposureTrial.className}`}>
        Timeline
      </h1>

      <div className="space-y-12 text-foreground">
        <article className="border-l-2 border-border pl-8 py-4">
          <time className="text-sm text-muted-foreground">Coming Soon</time>
          <h2 className="text-2xl font-semibold mt-2 mb-4">Stay Tuned</h2>
          <p className="text-foreground/80 leading-relaxed">
            We're working on building something incredible. Timeline details and demos will appear here as we progress.
          </p>
        </article>
      </div>
    </>
  );
}
