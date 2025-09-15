import type { Metadata } from "next";
import { SignInForm } from "../_components/sign-in-form";

export const metadata: Metadata = {
	title: "Sign In - Lightfast Chat",
	description: "Sign in to Lightfast Chat - Free open-source AI chat interface. Access your account and start chatting with multiple AI models.",
	robots: {
		index: false,
		follow: true,
	},
};

export default function SignInPage() {
	return <SignInForm />;
}