"use client";

import { useState } from "react";
import { Github } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";
import { useQueryClient } from "@tanstack/react-query";

interface GitHubConnectDialogProps {
	children?: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onSuccess?: () => void;
}

/**
 * GitHub App Connection Dialog (Step 1)
 *
 * This dialog handles the initial GitHub App OAuth connection.
 * After successful connection, it triggers the environment setup flow.
 */
export function GitHubConnectDialog({
	children,
	open: controlledOpen,
	onOpenChange,
	onSuccess,
}: GitHubConnectDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [internalOpen, setInternalOpen] = useState(false);

	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;

	const handleGitHubAuth = async () => {
		try {
			const data = await queryClient.fetchQuery(
				trpc.connections.getAuthorizeUrl.queryOptions({ provider: "github" }),
			);

			const width = 600;
			const height = 700;
			const left = window.screenX + (window.outerWidth - width) / 2;
			const top = window.screenY + (window.outerHeight - height) / 2;

			const popup = window.open(
				data.url,
				"github-install",
				`width=${width},height=${height},left=${left},top=${top},popup=1`,
			);

			// Poll for popup close
			const pollTimer = setInterval(() => {
				if (popup?.closed) {
					clearInterval(pollTimer);
					setOpen(false);
					toast.success("GitHub connected", {
						description: "Successfully connected to GitHub. You can now set up environments.",
					});
					onSuccess?.();
				}
			}, 500);
		} catch {
			toast.error("Failed to connect GitHub");
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{children && <DialogTrigger asChild>{children}</DialogTrigger>}
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Github className="h-5 w-5" />
						Connect GitHub
					</DialogTitle>
					<DialogDescription>
						Connect your GitHub account to enable Console to orchestrate workflows on your codebase.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-4">
					<div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center">
						<Github className="mx-auto h-12 w-12 text-muted-foreground/60" />
						<p className="mt-3 text-sm text-muted-foreground">
							Connect to GitHub to get started
						</p>
					</div>

					{/* Permission notices matching the reference image */}
					<div className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4">
						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
								<svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
								</svg>
							</div>
							<div>
								<p className="text-sm font-medium">Permissions always respected</p>
								<p className="text-xs text-muted-foreground mt-1">
									Console is strictly limited to permissions you've explicitly set.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
								<svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
							</div>
							<div>
								<p className="text-sm font-medium">You're in control</p>
								<p className="text-xs text-muted-foreground mt-1">
									Console always respects your training data preferences, and is limited to permissions you've explicitly set.
								</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10">
								<svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
								</svg>
							</div>
							<div>
								<p className="text-sm font-medium">Connectors may introduce risk</p>
								<p className="text-xs text-muted-foreground mt-1">
									Connectors are designed to respect your privacy, but sites may attempt to steal your data.{" "}
									<a href="#" className="text-primary hover:underline">Learn more on how to stay safe</a>
								</p>
							</div>
						</div>
					</div>

					<Button onClick={handleGitHubAuth} className="w-full gap-2" size="lg">
						<Github className="h-4 w-4" />
						Continue to GitHub
					</Button>

					<p className="text-xs text-center text-muted-foreground">
						You'll be redirected to GitHub to authorize access. We only request the minimum permissions needed.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
