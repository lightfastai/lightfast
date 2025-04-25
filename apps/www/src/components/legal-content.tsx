import Link from "next/link";
import { AlertCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";

import { emailConfig } from "~/config/email";

interface LegalContentProps {
  type: "privacy" | "terms";
}

const TITLES = {
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
} as const;

export function LegalContent({ type }: LegalContentProps) {
  const title = TITLES[type];

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold sm:text-xl">{title}</h1>
      <Alert>
        <AlertCircle className="size-4" />
        <AlertTitle className="text-sm sm:text-base">Coming Soon</AlertTitle>
        <AlertDescription className="text-xs sm:text-sm">
          <span>
            We are currently finalizing our {title}. Please check back soon. If
            you have any immediate{" "}
            {type === "privacy" ? "privacy concerns" : "questions"}, feel free
            to reach out to{" "}
            <span className="font-medium">
              <Link
                href={`mailto:${emailConfig.legal}`}
                className="underline hover:text-primary"
              >
                {emailConfig.legal}
              </Link>
            </span>
            .
          </span>
        </AlertDescription>
      </Alert>
    </>
  );
}
