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
		<div className="text-left space-y-4 sm:space-y-6">
			<p className="text-xs font-mono text-muted-foreground">Build modern AI agents</p>
			<h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-5xl max-w-2xl">
				Build, Ship, Monitor
			</h1>

			<p className="max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
				Start your project with state-machine orchestration, resource
				scheduling, built-in security, human-in-the-loop workflows, and
				infinitely scalable agent execution.
			</p>

			<div className="flex items-center flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
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
	);
}
