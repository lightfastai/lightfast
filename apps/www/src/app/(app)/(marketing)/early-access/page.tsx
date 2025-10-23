import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Early Access - AI Workflow Automation Platform",
  description:
    "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation for technical founders.",
  keywords: [
    "AI workflow automation early access",
    "workflow orchestration beta",
    "AI integration platform waitlist",
    "early access program",
    "startup automation tools",
    "dev workflow automation",
    "AI orchestration platform",
  ],
  openGraph: {
    title: "Early Access - AI Workflow Automation Platform",
    description:
      "Join the waitlist for early access to Lightfast. Be among the first to experience the future of AI workflow automation.",
    url: "https://lightfast.ai/early-access",
    type: "website",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "AI Workflow Automation Platform",
      },
    ],
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
};

export default function EarlyAccessPage() {
  return null;
}
