import type { Metadata } from "next";

import { LegalContent } from "~/components/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy - Lightfast AI Agent Platform",
  description: "Privacy Policy for Lightfast - Cloud-native AI agent execution engine. Learn how we protect your data and privacy when using our AI agent infrastructure platform.",
  keywords: [
    "Lightfast privacy policy",
    "AI platform privacy",
    "data protection policy",
    "AI agent data privacy",
    "cloud infrastructure privacy",
    "developer platform privacy",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Privacy Policy - Lightfast AI Agent Platform",
    description: "Privacy Policy for Lightfast AI agent infrastructure platform. Learn how we protect your data and privacy.",
    url: "https://lightfast.ai/legal/privacy",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy - Lightfast AI Agent Platform", 
    description: "Privacy Policy for Lightfast AI agent infrastructure platform. Learn how we protect your data and privacy.",
  },
  alternates: {
    canonical: "https://lightfast.ai/legal/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalContent type="privacy" />;
}
