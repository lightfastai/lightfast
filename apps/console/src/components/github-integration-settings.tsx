"use client";

import { Github } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

export function GitHubIntegrationSettings() {
	// Note: GitHub integration details are accessed via repository connections
	// This page shows general GitHub App information

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Github className="h-5 w-5" />
						GitHub App Integration
					</CardTitle>
					<CardDescription>
						GitHub repositories are connected through the Repositories page
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Permissions Info */}
					<div className="rounded-lg border border-border/60 bg-muted/5 p-4">
						<div className="space-y-3">
							<div>
								<p className="text-sm font-medium">App Permissions</p>
								<p className="text-xs text-muted-foreground mt-1">
									The Lightfast Console GitHub App has the following permissions
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

					{/* Help Text */}
					<div className="rounded-lg border border-border/60 bg-muted/5 p-4">
						<p className="text-sm text-muted-foreground">
							To connect GitHub repositories, go to the{" "}
							<span className="font-medium text-foreground">Repositories</span> page
							in settings. You can connect repositories from any GitHub organization
							where the Lightfast Console App is installed.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
