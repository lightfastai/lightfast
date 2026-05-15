import { createMetadata } from "@vendor/seo/metadata";
import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = createMetadata({
  title: "Sign Up - Lightfast Auth",
  description:
    "Create your Lightfast account to access the AI agent platform. Secure sign-up portal for developers.",
  openGraph: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
    url: "https://lightfast.ai/sign-up",
  },
  twitter: {
    title: "Sign Up - Lightfast Auth",
    description:
      "Create your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://lightfast.ai/sign-up",
  },
  robots: {
    index: true,
    follow: false,
  },
});

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
