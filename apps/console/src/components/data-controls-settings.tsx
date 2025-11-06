"use client";

import { useState } from "react";
import { Github, CheckCircle2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { GitHubConnectDialog } from "./github-connect-dialog";

export function DataControlsSettings() {
	const [isGitHubConnected, setIsGitHubConnected] = useState(false);
	const [showConnectDialog, setShowConnectDialog] = useState(false);

	// TODO: Check if GitHub is actually connected via API call
	// For now, we'll use local state

	const handleGitHubConnectSuccess = () => {
		setIsGitHubConnected(true);
		setShowConnectDialog(false);
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Github className="h-5 w-5" />
						GitHub Connection
					</CardTitle>
					<CardDescription>
						Connect your GitHub account to enable Console to orchestrate workflows on your codebase
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{isGitHubConnected ? (
						<div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/10 p-4">
							<div className="flex items-center gap-3">
								<CheckCircle2 className="h-5 w-5 text-green-500" />
								<div>
									<p className="text-sm font-medium">GitHub Connected</p>
									<p className="text-xs text-muted-foreground">
										You can now create environments with your repositories
									</p>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsGitHubConnected(false)}
							>
								Disconnect
							</Button>
						</div>
					) : (
						<>
							<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6">
								<div className="flex flex-col items-center text-center">
									<Github className="h-12 w-12 text-muted-foreground/60" />
									<p className="mt-3 text-sm font-medium">
										GitHub not connected
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Connect your GitHub account to get started with Console
									</p>
								</div>
							</div>

							<Button
								onClick={() => setShowConnectDialog(true)}
								className="w-full gap-2"
							>
								<Github className="h-4 w-4" />
								Connect GitHub
							</Button>
						</>
					)}
				</CardContent>
			</Card>

			<GitHubConnectDialog
				open={showConnectDialog}
				onOpenChange={setShowConnectDialog}
				onSuccess={handleGitHubConnectSuccess}
			/>
		</div>
	);
}
