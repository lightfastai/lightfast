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
  title: "Privacy",
  description: "Privacy Policy for Lightfast",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto flex h-[calc(100vh-12rem)] flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold">Privacy Policy</h1>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Coming Soon</AlertTitle>
          <AlertDescription className="flex flex-row text-xs">
            <span>
              We are currently finalizing our Privacy Policy. Please check back
              soon. If you have any immediate privacy concerns, feel free to
              reach out to{" "}
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
