import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Features",
  description: "Explore Lightfast capabilities. Stay tuned for updates.",
  alternates: {
    canonical: "https://lightfast.ai/features",
  },
});

export default function FeaturesPage() {
  return (
    <>
      <h1 className={`text-6xl font-light leading-[1.2] tracking-[-0.7] text-foreground mb-8 ${exposureTrial.className}`}>
        Features
      </h1>

      <div className="space-y-12 text-foreground">
        <article className="border-l-2 border-border pl-8 py-4">
          <time className="text-sm text-muted-foreground">Coming Soon</time>
          <h2 className="text-2xl font-semibold mt-2 mb-4">Stay Tuned</h2>
          <p className="text-foreground/80 leading-relaxed">
            We're working on building something incredible. Feature overviews and
            announcements will appear here as we progress.
          </p>
        </article>
      </div>
    </>
  );
}
