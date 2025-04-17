import Link from "next/link";
import { AlertCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";

import { SiteFooter } from "~/components/site-footer";
import { siteConfig } from "~/config/site";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex h-[calc(100vh-6rem)] max-w-2xl flex-col justify-center">
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
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="underline hover:text-primary"
                >
                  {siteConfig.contactEmail}
                </Link>
              </span>
              .
            </span>
          </AlertDescription>
        </Alert>
      </div>
      <SiteFooter />
    </div>
  );
}
