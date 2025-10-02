"use client";
import * as React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { OAuthSignIn } from "./oauth-sign-in";

export function SignInForm() {
	return (
		<div className="w-full space-y-8">
			{/* Header */}
			<div className="text-center">
				<h1 className="text-3xl font-semibold text-foreground">
					Log in to Deus
				</h1>
			</div>

			<div className="space-y-4">
				{/* OAuth Sign In */}
				<OAuthSignIn />
			</div>

			{/* Sign Up Link */}
			<div className="text-center text-sm">
				<span className="text-muted-foreground">Don't have an account? </span>
				<Button
					asChild
					variant="link-blue"
					className="inline-flex h-auto p-0 rounded-none text-sm"
				>
					<Link href="/sign-up">Sign Up</Link>
				</Button>
			</div>
		</div>
	);
}
