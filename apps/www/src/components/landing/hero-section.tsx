"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { getAppUrl } from "@repo/url-utils";

export function HeroSection() {
	const cloudUrl = getAppUrl("cloud");
	const authUrl = getAppUrl("auth");
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
		<div className="text-center space-y-4 sm:space-y-6 lg:space-y-8 flex flex-col items-center">
			<h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl">
				Cloud-native infrastructure for modern AI-agents
			</h1>

			<div className="space-y-2 sm:space-y-3">
				<p className="mx-auto max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
					Start your project with state-machine orchestration, resource
					scheduling, built-in security, human-in-the-loop workflows, and
					infinitely scalable agent execution.
				</p>
			</div>

			<div className="flex items-center justify-center flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
				<div className="flex items-center gap-3">
					<Button size="default" asChild>
						<Link href={cloudUrl}>Join waitlist</Link>
					</Button>
					<div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg border">
						<span className="text-sm font-mono text-muted-foreground">$</span>
						<span className="text-sm font-mono">npm i lightfast</span>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0 hover:bg-transparent"
							onClick={copyToClipboard}
						>
							{copied ? (
								<CheckIcon className="h-4 w-4 text-green-600" />
							) : (
								<CopyIcon className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
							)}
						</Button>
					</div>
				</div>
				<Button
					size="default"
					variant="outline"
					asChild
				>
					<Link href={`${authUrl}/sign-in`}>Sign in</Link>
				</Button>
			</div>
		</div>
	);
}
