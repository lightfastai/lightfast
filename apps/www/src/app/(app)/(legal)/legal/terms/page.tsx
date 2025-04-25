import type { Metadata } from "next";

import { LegalContent } from "~/components/legal-content";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms & Conditions for Lightfast.ai",
};

export default function TermsPage() {
  return <LegalContent type="terms" />;
}
