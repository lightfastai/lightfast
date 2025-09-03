"use client";

import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { getAppUrl } from "@repo/url-utils";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface RateLimitDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function RateLimitDialog({ open, onOpenChange }: RateLimitDialogProps) {

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm p-0 rounded-2xl overflow-hidden">
				{/* Visually hidden title for accessibility */}
				<VisuallyHidden>
					<DialogTitle>Daily message limit reached</DialogTitle>
				</VisuallyHidden>
				
				{/* Custom close button */}
				<Button
					variant="secondary"
					size="icon"
					className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full"
					onClick={() => onOpenChange(false)}
				>
					<X className="h-4 w-4" />
				</Button>

				{/* Image at the top with no padding, matching auth-prompt-selector */}
				<div className="relative w-full h-[225px]">
					<Image
						src="/og-bg-only.jpg"
						alt="Lightfast AI"
						fill
						className="object-cover p-2 rounded-2xl"
						priority
						quality={20}
						loading="eager"
						sizes="(max-width: 384px) 100vw, 384px"
					/>
				</div>

				{/* Content section with padding - matching auth-prompt-selector */}
				<div className="p-3">
					<div className="flex flex-col gap-4">
						<div className="space-y-2">
							<h3 className="text-md font-semibold">
								Daily message limit reached
							</h3>
							<p className="text-sm text-muted-foreground">
								You've used all 10 free messages for today. Sign in to continue
								chatting with unlimited access to all models.
							</p>
						</div>

						<div className="space-y-2 text-sm text-muted-foreground">
							<p>With a free account, you get:</p>
							<ul className="list-disc list-inside space-y-1 ml-2">
								<li>Access to Claude, GPT-5, Gemini 2.5, and more</li>
								<li>Save and manage your conversations</li>
							</ul>
						</div>

						<div className="flex gap-2 w-full">
							<Button
								size="default"
								className="flex-1"
								variant="outline"
								asChild
							>
								<Link href={`/sign-in`}>Sign In</Link>
							</Button>
							<Button
								size="default"
								className="flex-1"
								variant="secondary"
								asChild
							>
								<Link href={`/sign-up`}>Sign Up</Link>
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
