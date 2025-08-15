"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Icons } from "@repo/ui/components/ui/icons";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { getAppUrl } from "@repo/url-utils";
import Link from "next/link";
import Image from "next/image";
import { useState, useMemo } from "react";
import {
	getDefaultModelForUser,
	getModelConfig,
	PROVIDER_ICONS,
} from "~/lib/ai/providers";

interface AuthPromptSelectorProps {
	className?: string;
}

export function AuthPromptSelector({ className }: AuthPromptSelectorProps) {
	const [open, setOpen] = useState(false);
	const authUrl = getAppUrl("auth");

	// Get the default model for unauthenticated users
	const defaultModel = useMemo(() => {
		const modelId = getDefaultModelForUser(false);
		return getModelConfig(modelId);
	}, []);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"justify-between rounded-full dark:border-border/30 dark:shadow-sm",
						className,
					)}
				>
					<div className="flex items-center gap-2">
						{(() => {
							const iconName = PROVIDER_ICONS[
								defaultModel.iconProvider
							] as keyof typeof Icons;
							const IconComponent = Icons[iconName];
							return <IconComponent className="w-4 h-4 shrink-0" />;
						})()}
						<span className="truncate text-xs">{defaultModel.displayName}</span>
					</div>
					<ChevronDown className="h-3 w-3 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="max-w-sm p-0 rounded-2xl overflow-hidden"
			>
				{/* Image at the top with no padding, matching agent-info-modal */}
				<div className="relative w-full h-[125px]">
					<Image
						src="/og-bg-only.jpg"
						alt="Lightfast AI"
						fill
						className="object-cover p-2 rounded-2xl"
						priority
						quality={20}
					/>
				</div>

				{/* Content section with padding */}
				<div className="p-3">
					<div className="flex flex-col gap-4">
						<div className="space-y-2">
							<h3 className="text-sm font-semibold">
								Login to try more features for free
							</h3>
							<p className="text-xs text-muted-foreground">
								Get access to models such as Claude Sonnet, Gemini 2.5, GPT 5
								and many more.
							</p>
						</div>

						<div className="flex gap-2 w-full">
							<Button
								size="default"
								className="flex-1"
								variant="outline"
								asChild
							>
								<Link href={`${authUrl}/sign-in`}>Sign In</Link>
							</Button>
							<Button
								size="default"
								className="flex-1"
								variant="secondary"
								asChild
							>
								<Link href={`${authUrl}/sign-up`}>Sign Up</Link>
							</Button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

