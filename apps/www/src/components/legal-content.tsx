import { Mdx } from "@repo/ui/components/mdx-components";

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
  return (
    <div className="max-w-none">
      <Mdx>{content[type]}</Mdx>
    </div>
  );
}
