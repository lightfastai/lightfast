import type { Metadata } from "next";

import { SignInForm } from "../_components/sign-in-form";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign In - Lightfast Auth",
  description: "Sign in to your Lightfast account to access the AI agent platform. Secure authentication portal for developers.",
  keywords: [
    "Lightfast sign in",
    "Lightfast login", 
    "AI platform login",
    "agent platform auth",
    "developer authentication"
  ],
  openGraph: {
    title: "Sign In - Lightfast Auth",
    description: "Sign in to your Lightfast account to access the AI agent platform.",
    url: "https://auth.lightfast.ai/sign-in",
  },
  twitter: {
    title: "Sign In - Lightfast Auth",
    description: "Sign in to your Lightfast account to access the AI agent platform.",
  },
  alternates: {
    canonical: "https://auth.lightfast.ai/sign-in",
  },
  robots: {
    index: true,
    follow: false, // Don't follow links from auth pages
  },
};

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