import type { Metadata } from "next";
import { SignInForm } from "../_components/sign-in-form";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
	title: "Sign In - Lightfast Chat",
	description:
		"Sign in to Lightfast Chat - Free open-source AI chat interface. Access your account and start chatting with multiple AI models.",
	robots: {
		index: false,
		follow: true,
	},
});

export default function SignInPage() {
	return <SignInForm />;
}
