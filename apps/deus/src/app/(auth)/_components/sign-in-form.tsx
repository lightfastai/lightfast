"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { OAuthSignIn } from "./oauth-sign-in";
import { SignInPassword } from "./sign-in-password";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";

export function SignInForm() {
	const router = useRouter();
	const [error, setError] = React.useState<string | null>(null);

	const handlePasswordSuccess = () => {
		router.push("/");
	};

	const handlePasswordError = (errorMessage: string) => {
		setError(errorMessage);
	};

	return (
		<div className="w-full space-y-8">
			{/* Header */}
			<div className="text-center">
				<h1 className="text-3xl font-semibold text-foreground">
					Log in to Deus
				</h1>
			</div>

			<div className="space-y-4">
				{/* Error Message */}
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{/* Password Sign In */}
				<SignInPassword
					onSuccess={handlePasswordSuccess}
					onError={handlePasswordError}
				/>

				{/* Divider */}
				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">
							Or continue with
						</span>
					</div>
				</div>

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
