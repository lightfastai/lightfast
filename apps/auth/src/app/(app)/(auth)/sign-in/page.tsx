import type { Metadata } from "next";

import { SignInForm } from "../_components/sign-in-form";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Sign In - Lightfast Auth",
  description:
    "Sign in to your Lightfast account to access the AI agent platform. Secure authentication portal for developers.",
  openGraph: {
    title: "Sign In - Lightfast Auth",
    description:
      "Sign in to your Lightfast account to access the AI agent platform.",
    url: "https://lightfast.ai/sign-in",
  },
  twitter: {
    title: "Sign In - Lightfast Auth",
    description:
      "Sign in to your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://lightfast.ai/sign-in",
  },
  robots: {
    index: true,
    follow: false,
  },
});

export default function SignInPage() {
	return (
		<>
			<SignedOut>
				<RedirectToTasks />
			</SignedOut>
			<SignInForm />
		</>
	);
}
