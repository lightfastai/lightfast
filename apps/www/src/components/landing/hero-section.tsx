"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { cloudUrl, authUrl } from "~/lib/related-projects";

export function HeroSection() {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText("npm i lightfast");
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	return (
		<div className="text-left">
			<div className="space-y-0">
				<div className="relative">
					<p className="text-xs font-mono text-muted-foreground mb-6">
						Build modern AI agents
					</p>
					<h1 className="font-bold tracking-tighter leading-[0.9] max-w-7xl">
						<span className="block text-7xl -mx-1 md:-mx-2 sm:text-8xl md:text-9xl lg:text-[8rem] xl:text-[10rem]">
							Build. Ship.
						</span>
						<span className="block text-7xl sm:text-8xl md:text-9xl lg:text-[8rem] xl:text-[10rem] text-right">
							Monitor.
						</span>
					</h1>
				</div>

				<div className="max-w-xl space-y-6">
					<p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
						Start your project with state-machine orchestration, resource
						scheduling, built-in security, human-in-the-loop workflows, and
						infinitely scalable agent execution.
					</p>

					<div className="flex items-center flex-col sm:flex-row gap-3 sm:gap-4">
						<Button size="default" asChild>
							<Link href={cloudUrl}>Join waitlist</Link>
						</Button>
						<Button
							size="default"
							variant="outline"
							onClick={copyToClipboard}
							className="font-mono"
						>
							<span className="text-muted-foreground mr-1">$</span>
							npm i lightfast
							{copied ? (
								<CheckIcon className="ml-2 h-4 w-4 text-green-600" />
							) : (
								<CopyIcon className="ml-2 h-4 w-4" />
							)}
						</Button>
						<Button size="default" variant="outline" asChild>
							<Link href={`${authUrl}/sign-in`}>Try Chat</Link>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
