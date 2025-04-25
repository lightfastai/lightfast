import type { Metadata } from "next";

import { LegalContent } from "~/components/legal-content";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy Policy for Lightfast",
};

export default function PrivacyPage() {
  return <LegalContent type="privacy" />;
}
