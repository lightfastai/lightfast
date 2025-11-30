import type { Metadata } from "next";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Early Access - AI Workflow Automation Platform",
  description:
    "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation for technical founders.",
  openGraph: {
    title: "Early Access - AI Workflow Automation Platform",
    description:
      "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation.",
    url: "https://lightfast.ai/early-access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Early Access - AI Workflow Automation Platform",
    description:
      "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/early-access",
  },
});

export default function EarlyAccessPage() {
  return null;
}
