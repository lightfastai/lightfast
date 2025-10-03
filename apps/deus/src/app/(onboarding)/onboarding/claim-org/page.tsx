"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import type { GitHubInstallation } from "~/lib/github-app";

/**
 * Claim Organization Page
 *
 * Shows user's GitHub installations (organizations) and allows them to claim one.
 * After claiming, user is redirected to their org's home page.
 */
export default function ClaimOrgPage() {
	const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
	const [loading, setLoading] = useState(true);
	const [claiming, setClaiming] = useState<number | null>(null);
	const { toast } = useToast();
	const router = useRouter();

	useEffect(() => {
		void fetchInstallations();
	}, []);

	const fetchInstallations = async () => {
		try {
			const response = await fetch("/api/github/installations");
			if (!response.ok) {
				throw new Error("Failed to fetch installations");
			}
			const data = (await response.json()) as {
				installations: GitHubInstallation[];
			};
			setInstallations(data.installations);
		} catch {
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

			const data = (await response.json()) as { orgId: number };

			const accountName = installation.account
				? "login" in installation.account
					? installation.account.login
					: "slug" in installation.account
						? installation.account.slug
						: "Unknown"
				: "Unknown";

			toast({
				title: "Organization claimed!",
				description: `Successfully claimed ${accountName}`,
			});

			// Redirect to organization home
			router.push(`/org/${data.orgId}/settings`);
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
		<div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<div className="w-full max-w-2xl">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-semibold tracking-tight text-foreground">
						Claim an organization
					</h1>
					<p className="mt-2 text-muted-foreground">
						Select a GitHub organization to create your workspace
					</p>
				</div>

				{installations.length === 0 ? (
					<Card>
						<CardHeader>
							<CardTitle>No organizations found</CardTitle>
							<CardDescription>
								You need to install the Deus GitHub App on at least one
								organization.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="w-full">
								<a
									href="https://github.com/apps/deus-app/installations/new"
									target="_blank"
									rel="noopener noreferrer"
								>
									<Github className="mr-2 h-4 w-4" />
									Install GitHub App
								</a>
							</Button>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4">
						{installations.map((installation) => {
							const account = installation.account;
							const isClaiming = claiming === installation.id;

							if (!account) return null;

							const accountName = "login" in account ? account.login : "slug" in account ? account.slug : "Unknown";
							const accountType = "type" in account ? account.type : "Organization";

							return (
								<Card
									key={installation.id}
									className="transition-colors hover:bg-muted/50"
								>
									<CardContent className="flex items-center gap-4 p-6">
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
											<p className="text-sm text-muted-foreground">
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
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}

				<div className="mt-6 text-center">
					<p className="text-sm text-muted-foreground">
						Don't see your organization?{" "}
						<a
							href="https://github.com/apps/deus-app/installations/new"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							Install the GitHub App
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
