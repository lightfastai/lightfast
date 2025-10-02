"use client";
import * as React from "react";
import { Button } from "@repo/ui/components/ui/button";
import { OAuthSignUp } from "./oauth-sign-up";
import Link from "next/link";
import { siteConfig } from "@repo/site-config";

export function SignUpForm() {
	return (
		<div className="w-full space-y-8">
			{/* Header */}
			<div className="text-center">
				<h1 className="text-3xl font-semibold text-foreground">
					Sign up for Deus
				</h1>
			</div>

			<div className="space-y-4">
				{/* OAuth Sign Up */}
				<OAuthSignUp />

				{/* Legal compliance text */}
				<p className="text-xs text-center text-muted-foreground">
					By joining, you agree to our{" "}
					<Link
						href={siteConfig.links.terms.href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-foreground hover:text-foreground/80 underline"
					>
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link
						href={siteConfig.links.privacy.href}
						target="_blank"
						rel="noopener noreferrer"
						className="text-foreground hover:text-foreground/80 underline"
					>
						Privacy Policy
					</Link>
				</p>
			</div>

			{/* Sign In Link */}
			<div className="text-center text-sm">
				<span className="text-muted-foreground">Already have an account? </span>
				<Button
					asChild
					variant="link-blue"
					className="inline-flex h-auto p-0 rounded-none text-sm"
				>
					<Link href="/sign-in">Log In</Link>
				</Button>
			</div>
		</div>
	);
}
