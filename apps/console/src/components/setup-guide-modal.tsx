"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, FileText } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { useToast } from "@repo/ui/hooks/use-toast";

interface SetupGuideModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	repositoryName: string;
}

const DEFAULT_CONFIG = `# Lightfast Configuration
# Docs: https://docs.lightfast.com/config

version: 1

# Store name (unique identifier for this documentation set)
store: docs

# Files to include (glob patterns)
include:
  - "docs/**/*.md"
  - "docs/**/*.mdx"
  - "README.md"

# Files to exclude (optional)
exclude:
  - "**/node_modules/**"
  - "**/.git/**"
`;

/**
 * Setup Guide Modal
 *
 * Shows instructions for setting up lightfast.yml configuration.
 * Provides a template config that can be copied.
 */
export function SetupGuideModal({
	open,
	onOpenChange,
	repositoryName,
}: SetupGuideModalProps) {
	const [copied, setCopied] = useState(false);
	const { toast } = useToast();

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(DEFAULT_CONFIG);
			setCopied(true);
			toast({
				title: "Copied to clipboard",
				description: "lightfast.yml template has been copied.",
			});
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({
				title: "Copy failed",
				description: "Failed to copy to clipboard. Please copy manually.",
				variant: "destructive",
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Setup Configuration for {repositoryName}
					</DialogTitle>
					<DialogDescription>
						Create a <code className="rounded bg-muted px-1.5 py-0.5 text-sm">lightfast.yml</code> file
						in your repository root to configure documentation indexing.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Steps */}
					<div className="space-y-4">
						<h3 className="text-sm font-semibold">Setup Steps</h3>
						<ol className="space-y-3 text-sm">
							<li className="flex gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
									1
								</span>
								<div>
									<p className="font-medium">Copy the configuration template below</p>
									<p className="mt-1 text-xs text-muted-foreground">
										This is a starter template that indexes common documentation paths
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
									2
								</span>
								<div>
									<p className="font-medium">Create <code className="rounded bg-muted px-1 py-0.5 text-xs">lightfast.yml</code> in repository root</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Place it at the root level of your repository (same level as README)
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
									3
								</span>
								<div>
									<p className="font-medium">Customize paths to match your docs</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Edit the <code className="rounded bg-muted px-1 py-0.5 text-xs">include</code> patterns to match your documentation structure
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
									4
								</span>
								<div>
									<p className="font-medium">Commit and push to main branch</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Indexing will start automatically on the next push
									</p>
								</div>
							</li>
						</ol>
					</div>

					{/* Template */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold">Configuration Template</h3>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopy}
								className="gap-2"
							>
								{copied ? (
									<>
										<Check className="h-3.5 w-3.5" />
										Copied
									</>
								) : (
									<>
										<Copy className="h-3.5 w-3.5" />
										Copy
									</>
								)}
							</Button>
						</div>
						<div className="relative rounded-lg border bg-muted/50">
							<pre className="overflow-x-auto p-4 text-xs">
								<code>{DEFAULT_CONFIG}</code>
							</pre>
						</div>
					</div>

					{/* Help Links */}
					<div className="rounded-lg border border-muted bg-muted/20 p-4">
						<h3 className="mb-2 text-sm font-semibold">Need Help?</h3>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li className="flex items-center gap-2">
								<ExternalLink className="h-3.5 w-3.5" />
								<a
									href="https://docs.lightfast.com/config"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground hover:underline"
								>
									Full configuration documentation
								</a>
							</li>
							<li className="flex items-center gap-2">
								<ExternalLink className="h-3.5 w-3.5" />
								<a
									href="https://docs.lightfast.com/glob-patterns"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground hover:underline"
								>
									Understanding glob patterns
								</a>
							</li>
							<li className="flex items-center gap-2">
								<ExternalLink className="h-3.5 w-3.5" />
								<a
									href="https://docs.lightfast.com/examples"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-foreground hover:underline"
								>
									Example configurations
								</a>
							</li>
						</ul>
					</div>

					{/* Actions */}
                <div className="flex justify-between gap-2">
                    <Button variant="outline" asChild>
                        <a
                            href={repositoryName ? `https://github.com/${repositoryName}/new/main?filename=lightfast.yml` : "https://github.com"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gap-2 inline-flex items-center"
                        >
                            <ExternalLink className="h-3.5 w-3.5" /> Open on GitHub
                        </a>
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
