"use client";

import { siteConfig } from "@/lib/site-config";
import { Card, CardContent } from "@lightfast/ui/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@lightfast/ui/components/ui/dialog";
import Link from "next/link";
import { ExternalSignInButton } from "./external-sign-in-button";

interface SignInDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md p-0 bg-transparent border-none shadow-none">
				<DialogTitle className="sr-only">Sign In</DialogTitle>
				<DialogDescription className="sr-only">
					Sign in to access your AI chat conversations
				</DialogDescription>
				<Card className="shadow-xl bg-background/80 backdrop-blur-sm">
					<CardContent className="p-8">
						<div className="text-center mb-6">
							<h2 className="text-xl font-semibold mb-2">
								Sign in to continue
							</h2>
							<p className="text-muted-foreground text-sm">
								Access your AI chat conversations
							</p>
						</div>

						<ExternalSignInButton
							className="w-full h-12 text-base font-medium"
							size="lg"
							variant="default"
						>
							Sign in with Lightfast Auth
						</ExternalSignInButton>

						<div className="mt-6 text-center">
							<p className="text-xs text-muted-foreground">
								By signing in, you agree to our{" "}
								<Link
									href={siteConfig.links.terms.href}
									target="_blank"
									className="underline"
									prefetch={false}
								>
									terms
								</Link>{" "}
								and{" "}
								<Link
									href={siteConfig.links.privacy.href}
									target="_blank"
									className="underline"
									prefetch={false}
								>
									privacy policy
								</Link>
							</p>
						</div>
					</CardContent>
				</Card>
			</DialogContent>
		</Dialog>
	);
}
