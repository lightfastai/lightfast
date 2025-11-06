import type { Metadata } from "next";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";
import { SignUpForm } from "../_components/sign-up-form";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
title: "Sign Up - Console",
	description:
	"Create your Console account. Join the AI workflow orchestration platform and start automating complex workflows with natural language.",
	robots: {
		index: false,
		follow: true,
	},
});

// Force dynamic rendering for Clerk integration
export const dynamic = 'force-dynamic';

export default function SignUpPage() {
	return (
		<>
			{/* RedirectToTasks handles both active AND pending sessions */}
			<RedirectToTasks />
			<SignedOut>
				<SignUpForm />
			</SignedOut>
		</>
	);
}
