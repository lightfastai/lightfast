import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { emailConfig } from "@repo/lightfast-config";
import { Mdx } from "@repo/ui/components/mdx-components";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";

import { privacyContent } from "~/content/legal/privacy";
import { termsContent } from "~/content/legal/terms";

interface LegalContentProps {
  type: "privacy" | "terms";
}

const TITLES = {
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
} as const;

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
