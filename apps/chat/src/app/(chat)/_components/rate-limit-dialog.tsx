"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { getAppUrl } from "@repo/url-utils";
import Link from "next/link";
import Image from "next/image";

interface RateLimitDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function RateLimitDialog({ open, onOpenChange }: RateLimitDialogProps) {
	const authUrl = getAppUrl("auth");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				{/* Header image */}
				<div className="relative w-full h-[150px] -mx-6 -mt-6 mb-4">
					<Image
						src="/og-bg-only.jpg"
						alt="Lightfast AI"
						fill
						className="object-cover rounded-t-lg"
						priority
						quality={20}
					/>
				</div>

				<DialogHeader>
					<DialogTitle>Daily message limit reached</DialogTitle>
					<DialogDescription>
						You've used all 10 free messages for today. Sign in to continue
						chatting with unlimited access to all models.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 pt-4">
					<div className="space-y-2 text-sm text-muted-foreground">
						<p>With a free account, you get:</p>
						<ul className="list-disc list-inside space-y-1 ml-2">
							<li>Unlimited messages</li>
							<li>Access to Claude, GPT-5, Gemini 2.5, and more</li>
							<li>Save and manage your conversations</li>
							<li>Priority support</li>
						</ul>
					</div>

					<div className="flex gap-3">
						<Button
							size="default"
							className="flex-1"
							variant="default"
							asChild
						>
							<Link href={`${authUrl}/sign-in`}>Sign In</Link>
						</Button>
						<Button
							size="default"
							className="flex-1"
							variant="outline"
							asChild
						>
							<Link href={`${authUrl}/sign-up`}>Sign Up</Link>
						</Button>
					</div>

					<Button
						variant="ghost"
						size="sm"
						className="w-full"
						onClick={() => onOpenChange(false)}
					>
						Maybe later
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}