import { Response } from "@repo/ui/components/ai-elements/response";

import { privacyContent } from "~/content/legal/privacy";
import { termsContent } from "~/content/legal/terms";

interface LegalContentProps {
  type: "privacy" | "terms";
}

const content = {
  privacy: privacyContent,
  terms: termsContent,
} as const;

export function LegalContent({ type }: LegalContentProps) {
  return <Response>{content[type]}</Response>;
}
