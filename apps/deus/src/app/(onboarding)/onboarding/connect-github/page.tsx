"use client";

import { Github, Lock, Shield, TriangleAlert } from "lucide-react";
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
			<Card className="w-full max-w-md border-0 shadow-none">
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
							<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
								<Lock className="h-3 w-3 text-primary" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">
									Permissions always respected
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Deus is strictly limited to permissions you've explicitly set.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
								<Shield className="h-3 w-3 text-primary" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">You're in control</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Deus always respects your training data preferences, and is
									limited to permissions you've explicitly set.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
								<TriangleAlert className="h-3 w-3 text-amber-500" />
							</div>
							<div className="flex-1">
								<p className="text-sm font-medium">
									Connectors may introduce risk
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Connectors are designed to respect your privacy, but sites may
									attempt to steal your data.{" "}
								</p>
							</div>
						</div>
					</div>

					<Button
						onClick={handleConnectGitHub}
						className="w-full gap-2"
						size="lg"
					>
						<Github className="h-4 w-4" />
						Continue to GitHub
					</Button>

					<p className="text-xs text-center text-muted-foreground">
						You'll be redirected to GitHub to authorize access. We only request
						the minimum permissions needed.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
