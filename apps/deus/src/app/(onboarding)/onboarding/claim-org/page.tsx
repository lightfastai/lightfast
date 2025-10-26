"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Github, Loader2, Building2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { useToast } from "@repo/ui/hooks/use-toast";
import type { GitHubInstallation } from "@repo/deus-octokit-github";

/**
 * Claim Organization Page
 *
 * Shows user's GitHub installations (organizations) and allows them to claim one.
 * After claiming, user is redirected to their org's home page.
 *
 * Auth is handled by the parent onboarding layout which uses treatPendingAsSignedOut={false}
 * to allow pending users (authenticated but no active org) to access this page.
 */
export default function ClaimOrgPage() {
	return <ClaimOrgContent />;
}

function ClaimOrgContent() {
	const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
	const [loading, setLoading] = useState(true);
	const [claiming, setClaiming] = useState<number | null>(null);
	const { toast } = useToast();
	const router = useRouter();
	const { setActive } = useClerk();

	useEffect(() => {
		void fetchInstallations();
	}, []);

	const fetchInstallations = async () => {
		try {
			const response = await fetch("/api/github/installations");

			// Handle authentication errors - redirect to connect GitHub
			if (response.status === 401) {
				console.log("GitHub authentication required, redirecting to connect-github");
				router.push("/onboarding/connect-github");
				return;
			}

			if (!response.ok) {
				throw new Error("Failed to fetch installations");
			}

			const data = (await response.json()) as {
				installations: GitHubInstallation[];
			};
			setInstallations(data.installations);
		} catch (error) {
			console.error("Failed to fetch installations:", error);
			toast({
				title: "Failed to fetch organizations",
				description:
					"Could not retrieve your GitHub organizations. Please try again.",
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleClaimOrg = async (installation: GitHubInstallation) => {
		setClaiming(installation.id);
		try {
			const response = await fetch("/api/organizations/claim", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					installationId: installation.id,
				}),
			});

			if (!response.ok) {
				const error = (await response.json()) as { error?: string };
				throw new Error(error.error ?? "Failed to claim organization");
			}

			const data = (await response.json()) as { orgId: number; slug: string };

			const accountName = installation.account
				? "login" in installation.account
					? installation.account.login
					: "slug" in installation.account
						? installation.account.slug
						: "Unknown"
				: "Unknown";

			console.log("[CLAIM ORG CLIENT] Setting active organization:", data.slug);

			// Set the claimed organization as active in Clerk session
			// This moves the session from "pending" to "active" state
			await setActive({
				organization: data.slug, // Can be org slug or org ID
			});

			console.log("[CLAIM ORG CLIENT] ✓ Organization set as active");

			toast({
				title: "Organization claimed!",
				description: `Successfully claimed ${accountName}`,
			});

			// Redirect to organization home using Clerk org slug
			// Session is now active, so user will have full access
			router.push(`/org/${data.slug}/settings`);
		} catch (error) {
			toast({
				title: "Failed to claim organization",
				description:
					error instanceof Error ? error.message : "Please try again.",
				variant: "destructive",
			});
			setClaiming(null);
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
					<p className="text-sm text-muted-foreground">
						Loading your organizations...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<Card className="w-full max-w-md border-0 shadow-none">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<Github className="h-6 w-6 text-primary" />
					</div>
					<CardTitle>Claim an organization</CardTitle>
					<CardDescription>
						Select a GitHub organization to create your workspace
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{installations.length === 0 ? (
						<div className="space-y-4 rounded-lg border border-border/60 bg-muted/5 p-4">
							<p className="text-sm text-muted-foreground text-center">
								You need to install the Deus GitHub App on at least one
								organization.
							</p>
							<div className="flex flex-col gap-2">
								<Button asChild className="w-full">
									<a
										href="https://github.com/apps/lightfast-deus-app-connector-dev/installations/new"
										target="_blank"
										rel="noopener noreferrer"
									>
										<Github className="mr-2 h-4 w-4" />
										Install GitHub App
									</a>
								</Button>
								<Button
									variant="outline"
									className="w-full"
									onClick={() => router.push("/onboarding/connect-github")}
								>
									Re-connect GitHub
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-3">
							{installations.map((installation) => {
								const account = installation.account;
								const isClaiming = claiming === installation.id;

								if (!account) return null;

								const accountName = "login" in account ? account.login : "slug" in account ? account.slug : "Unknown";
								const accountType = "type" in account ? account.type : "Organization";

								return (
									<div
										key={installation.id}
										className="flex items-center gap-4 rounded-lg border border-border/60 bg-muted/5 p-4 transition-colors hover:bg-muted/10"
									>
										{/* Organization Avatar */}
										<div className="flex-shrink-0">
											{account.avatar_url ? (
												<img
													src={account.avatar_url}
													alt={accountName}
													className="h-12 w-12 rounded-full"
												/>
											) : (
												<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
													<Building2 className="h-6 w-6 text-muted-foreground" />
												</div>
											)}
										</div>

										{/* Organization Info */}
										<div className="flex-1 min-w-0">
											<h3 className="font-semibold text-foreground">
												{accountName}
											</h3>
											<p className="text-xs text-muted-foreground">
												{accountType === "Organization"
													? "Organization"
													: "Personal Account"}
											</p>
										</div>

										{/* Claim Button */}
										<Button
											onClick={() => handleClaimOrg(installation)}
											disabled={isClaiming}
											size="sm"
										>
											{isClaiming ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Claiming...
												</>
											) : (
												"Claim"
											)}
										</Button>
									</div>
								);
							})}
						</div>
					)}

					<p className="text-xs text-center text-muted-foreground">
						Don't see your organization?{" "}
						<a
							href="https://github.com/apps/lightfast-deus-app-connector-dev/installations/new"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							Install the GitHub App
						</a>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
