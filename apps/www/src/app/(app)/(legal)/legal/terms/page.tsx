import type { Metadata } from "next";

import { LegalContent } from "~/components/legal-content";

export const metadata: Metadata = {
  title: "Terms & Conditions - Lightfast AI Agent Platform",
  description:
    "Terms & Conditions for Lightfast - Cloud-native AI agent execution engine. Review our terms of service for using our AI agent infrastructure platform and services.",
  keywords: [
    "Lightfast terms of service",
    "AI platform terms",
    "terms and conditions",
    "AI agent platform terms",
    "cloud infrastructure terms",
    "developer platform terms",
    "service agreement",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Terms & Conditions - Lightfast AI Agent Platform",
    description:
      "Terms & Conditions for Lightfast AI agent infrastructure platform. Review our terms of service.",
    url: "https://lightfast.ai/legal/terms",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Terms & Conditions - Lightfast AI Agent Platform",
    description:
      "Terms & Conditions for Lightfast AI agent infrastructure platform. Review our terms of service.",
  },
  alternates: {
    canonical: "https://lightfast.ai/legal/terms",
  },
};

export default function TermsPage() {
  return <LegalContent type="terms" />;
}
