"use client";

import { Github } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";

/**
 * GitHub Connection Onboarding Page
 *
 * First step in onboarding: Connect GitHub account.
 * After successful connection, user is redirected to claim-org page.
 */
export default function ConnectGitHubPage() {
	const handleConnectGitHub = () => {
		// Redirect to GitHub OAuth with callback to claim-org page
		const callbackUrl = encodeURIComponent("/onboarding/claim-org");
		window.location.href = `/api/github/auth?callback=${callbackUrl}`;
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<Github className="h-6 w-6 text-primary" />
					</div>
					<CardTitle>Connect GitHub</CardTitle>
					<CardDescription>
						Connect your GitHub account to get started with Deus
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Permission notices */}
					<div className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4">
						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
								<svg
									className="h-3.5 w-3.5 text-primary"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
							</div>
							<div>
								<p className="text-sm font-medium">Permissions always respected</p>
								<p className="text-xs text-muted-foreground mt-1">
									Deus is strictly limited to permissions you've explicitly set.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
								<svg
									className="h-3.5 w-3.5 text-primary"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
									/>
								</svg>
							</div>
							<div>
								<p className="text-sm font-medium">You're in control</p>
								<p className="text-xs text-muted-foreground mt-1">
									Deus always respects your training data preferences, and is
									limited to permissions you've explicitly set.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10">
								<svg
									className="h-3.5 w-3.5 text-amber-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<div>
								<p className="text-sm font-medium">Connectors may introduce risk</p>
								<p className="text-xs text-muted-foreground mt-1">
									Connectors are designed to respect your privacy, but sites may
									attempt to steal your data.{" "}
									<a href="#" className="text-primary hover:underline">
										Learn more on how to stay safe
									</a>
								</p>
							</div>
						</div>
					</div>

					<Button onClick={handleConnectGitHub} className="w-full gap-2" size="lg">
						<Github className="h-4 w-4" />
						Continue to GitHub
					</Button>

					<p className="text-xs text-center text-muted-foreground">
						You'll be redirected to GitHub to authorize access. We only request the
						minimum permissions needed.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
