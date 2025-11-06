import type { Metadata } from "next";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";
import { SignInForm } from "../_components/sign-in-form";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
title: "Sign In - Console",
	description:
	"Sign in to Console - AI Workflow Orchestration Platform. Access your account and start building AI-powered workflows.",
	robots: {
		index: false,
		follow: true,
	},
});

// Force dynamic rendering for Clerk integration
export const dynamic = 'force-dynamic';

export default function SignInPage() {
	return (
		<>
			{/* RedirectToTasks handles both active AND pending sessions */}
			<RedirectToTasks />
			<SignedOut>
				<SignInForm />
			</SignedOut>
		</>
	);
}
