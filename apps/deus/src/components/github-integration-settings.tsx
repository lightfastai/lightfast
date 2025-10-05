"use client";

import { Github, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import type { Organization } from "@db/deus/schema";

interface GitHubIntegrationSettingsProps {
	organization: Organization;
}

export function GitHubIntegrationSettings({ organization }: GitHubIntegrationSettingsProps) {
	const handleReconfigure = () => {
		// Open GitHub App configuration page
		window.open(
			`https://github.com/organizations/${organization.githubOrgSlug}/settings/installations`,
			"_blank",
			"noopener,noreferrer"
		);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Github className="h-5 w-5" />
						GitHub App Integration
					</CardTitle>
					<CardDescription>
						Manage your GitHub App connection and permissions
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Connection Status */}
					<div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
						<div className="flex items-start gap-3">
							<CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-green-500">
									GitHub App Connected
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									Your organization is connected to the Deus GitHub App
								</p>
							</div>
						</div>
					</div>

					{/* Organization Details */}
					<div className="space-y-4">
						<div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/5 p-4">
							<div className="flex items-center gap-3 min-w-0">
								{organization.githubOrgAvatarUrl ? (
									<img
										src={organization.githubOrgAvatarUrl}
										alt={organization.githubOrgName}
										className="h-10 w-10 rounded-full shrink-0"
									/>
								) : (
									<div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
										<Github className="h-5 w-5 text-muted-foreground" />
									</div>
								)}
								<div className="min-w-0">
									<p className="text-sm font-medium truncate">
										{organization.githubOrgName}
									</p>
									<p className="text-xs text-muted-foreground">
										@{organization.githubOrgSlug}
									</p>
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								asChild
							>
								<a
									href={`https://github.com/${organization.githubOrgSlug}`}
									target="_blank"
									rel="noopener noreferrer"
								>
									<ExternalLink className="h-4 w-4" />
								</a>
							</Button>
						</div>

						{/* Installation ID */}
						<div className="rounded-lg border border-border/60 bg-muted/5 p-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">Installation ID</p>
									<p className="text-xs text-muted-foreground mt-1">
										{organization.githubInstallationId}
									</p>
								</div>
								<div className="text-xs text-muted-foreground">
									Active
								</div>
							</div>
						</div>
					</div>

					{/* Permissions Info */}
					<div className="rounded-lg border border-border/60 bg-muted/5 p-4">
						<div className="space-y-3">
							<div>
								<p className="text-sm font-medium">App Permissions</p>
								<p className="text-xs text-muted-foreground mt-1">
									This app has access to repositories you've granted permission to
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
									Repository: Read & Write
								</span>
								<span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
									Pull Requests: Read & Write
								</span>
								<span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
									Workflows: Read & Write
								</span>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex gap-3">
						<Button
							variant="outline"
							onClick={handleReconfigure}
							className="flex-1 gap-2"
						>
							<RefreshCw className="h-4 w-4" />
							Reconfigure on GitHub
						</Button>
						<Button
							variant="outline"
							asChild
							className="flex-1 gap-2"
						>
							<a
								href={`https://github.com/apps/lightfast-deus-app-connector-dev/installations/new`}
								target="_blank"
								rel="noopener noreferrer"
							>
								<Github className="h-4 w-4" />
								Reinstall App
							</a>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
