import type { Metadata } from "next";
import { SignUpForm } from "../_components/sign-up-form";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
	title: "Sign Up - Lightfast Chat",
	description:
		"Create your free Lightfast Chat account. Join the open-source AI chat platform and start conversations with GPT, Claude, Gemini, and more.",
	robots: {
		index: false,
		follow: true,
	},
});

export default function SignUpPage() {
	return <SignUpForm />;
}
