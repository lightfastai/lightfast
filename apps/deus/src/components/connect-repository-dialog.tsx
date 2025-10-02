"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, Github } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { useTRPC } from "@repo/deus-trpc/react";

interface ConnectRepositoryDialogProps {
	children?: React.ReactNode;
}

export function ConnectRepositoryDialog({
	children,
}: ConnectRepositoryDialogProps) {
	const [open, setOpen] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);

	const trpc = useTRPC();

	// Query to check if user has a connected repository
	const { data: repositories = [] } = useQuery({
		...trpc.repository.list.queryOptions({ includeInactive: false }),
		enabled: open,
	});

	const hasConnectedRepo = repositories.length > 0;

	const handleGitHubAuth = () => {
		setIsConnecting(true);

		// TODO: Implement GitHub OAuth flow
		// For now, we'll show a placeholder
		// In production, this should:
		// 1. Redirect to GitHub OAuth
		// 2. Handle callback with access_token
		// 3. Fetch repositories from GitHub API
		// 4. Let user select a repository
		// 5. Call connectMutation with the selected repo data

		console.log("GitHub OAuth flow not yet implemented");
		setIsConnecting(false);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitBranch className="h-5 w-5" />
						Connect GitHub Repository
					</DialogTitle>
					<DialogDescription>
						{hasConnectedRepo
							? "You can only connect one repository at a time. Please remove your existing repository before adding a new one."
							: "Connect a GitHub repository to enable Deus to orchestrate workflows on your codebase."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-4">
					{hasConnectedRepo ? (
						<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
									<Github className="h-5 w-5 text-amber-500" />
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium text-amber-500">
										Repository Already Connected
									</p>
									<p className="text-xs text-muted-foreground">
										{repositories[0]?.metadata?.fullName ?? "Repository connected"}
									</p>
								</div>
							</div>
						</div>
					) : (
						<>
							<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center">
								<Github className="mx-auto h-12 w-12 text-muted-foreground/60" />
								<p className="mt-3 text-sm text-muted-foreground">
									No repository connected yet
								</p>
							</div>

							<Button
								onClick={handleGitHubAuth}
								disabled={isConnecting}
								className="w-full gap-2"
							>
								<Github className="h-4 w-4" />
								{isConnecting ? "Connecting..." : "Connect with GitHub"}
							</Button>

							<p className="text-xs text-muted-foreground">
								You&apos;ll be redirected to GitHub to authorize access. We only
								request the minimum permissions needed.
							</p>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
