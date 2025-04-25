import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";

import { emailConfig } from "~/config/email";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms & Conditions for Lightfast.ai",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-lg font-semibold sm:text-xl">
          Terms & Conditions
        </h1>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle className="text-sm sm:text-base">Coming Soon</AlertTitle>
          <AlertDescription className="text-xs sm:text-sm">
            <span>
              We are currently finalizing our Terms & Conditions. Please check
              back soon. If you have any immediate questions, feel free to reach
              out to{" "}
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
      </div>
    </div>
  );
}
