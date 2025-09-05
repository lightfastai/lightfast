"use client";

import Link from "next/link";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { 
	Plus, 
	Key, 
	FileText, 
	Settings, 
	HelpCircle,
	ExternalLink,
	Zap
} from "lucide-react";

export function QuickActions() {
	return (
		<div className="space-y-6">
			{/* Primary Actions */}
			<Card>
				<CardContent className="p-6">
					<h3 className="font-medium text-foreground mb-4 flex items-center">
						<Zap className="h-4 w-4 mr-2 text-primary" />
						Get Started
					</h3>
					<div className="grid gap-3">
						<Button asChild className="justify-start h-auto p-4">
							<Link href="/api-keys/new">
								<div className="flex items-center space-x-3">
									<div className="flex-shrink-0">
										<Plus className="h-5 w-5" />
									</div>
									<div className="text-left">
										<div className="font-medium">Create API Key</div>
										<div className="text-sm opacity-90 font-normal">
											Generate a new key for CLI access
										</div>
									</div>
								</div>
							</Link>
						</Button>
						
						<Button variant="outline" asChild className="justify-start h-auto p-4">
							<Link href="/api-keys">
								<div className="flex items-center space-x-3">
									<div className="flex-shrink-0">
										<Key className="h-5 w-5" />
									</div>
									<div className="text-left">
										<div className="font-medium">Manage Keys</div>
										<div className="text-sm text-muted-foreground">
											View and revoke existing keys
										</div>
									</div>
								</div>
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Secondary Actions */}
			<Card>
				<CardContent className="p-6">
					<h3 className="font-medium text-foreground mb-4 flex items-center">
						<HelpCircle className="h-4 w-4 mr-2 text-muted-foreground" />
						Resources
					</h3>
					<div className="space-y-3">
						<Button variant="ghost" asChild className="justify-between w-full">
							<Link href="/docs" className="text-left">
								<div className="flex items-center space-x-3">
									<FileText className="h-4 w-4 text-muted-foreground" />
									<span>Documentation</span>
								</div>
								<ExternalLink className="h-3 w-3" />
							</Link>
						</Button>
						
						<Button variant="ghost" asChild className="justify-between w-full">
							<Link href="/docs/getting-started" className="text-left">
								<div className="flex items-center space-x-3">
									<Zap className="h-4 w-4 text-muted-foreground" />
									<span>Getting Started</span>
								</div>
								<ExternalLink className="h-3 w-3" />
							</Link>
						</Button>
						
						<Button variant="ghost" asChild className="justify-between w-full">
							<Link href="/settings" className="text-left">
								<div className="flex items-center space-x-3">
									<Settings className="h-4 w-4 text-muted-foreground" />
									<span>Account Settings</span>
								</div>
								<ExternalLink className="h-3 w-3" />
							</Link>
						</Button>
						
						<Button variant="ghost" asChild className="justify-between w-full">
							<Link href="/support" className="text-left">
								<div className="flex items-center space-x-3">
									<HelpCircle className="h-4 w-4 text-muted-foreground" />
									<span>Support Center</span>
								</div>
								<ExternalLink className="h-3 w-3" />
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* CLI Quick Setup */}
			<Card className="bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20">
				<CardContent className="p-6">
					<h3 className="font-medium text-foreground mb-2 flex items-center">
						<FileText className="h-4 w-4 mr-2 text-primary" />
						CLI Setup
					</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Get started with the Lightfast CLI in seconds
					</p>
					
					<div className="rounded-lg bg-background/50 p-3 border border-border/50 mb-4">
						<code className="text-xs text-foreground font-mono">
							npm install -g @lightfast/cli
						</code>
					</div>
					
					<div className="flex space-x-2">
						<Button variant="outline" size="sm" asChild>
							<Link href="/docs/cli/installation">
								View Guide
							</Link>
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<Link href="/api-keys/new">
								Create Key
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}