import type { Metadata } from "next";
import { SignInForm } from "../_components/sign-in-form";

export const metadata: Metadata = {
	title: "Sign In - Deus",
	description: "Sign in to Deus - AI Workflow Orchestration Platform. Access your account and start building AI-powered workflows.",
	robots: {
		index: false,
		follow: true,
	},
};

// Force dynamic rendering for Clerk integration
export const dynamic = 'force-dynamic';

export default function SignInPage() {
	return <SignInForm />;
}
