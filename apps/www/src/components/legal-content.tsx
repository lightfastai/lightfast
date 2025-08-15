import { Markdown } from "@repo/ui/components/markdown";

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
  return <Markdown>{content[type]}</Markdown>;
}
