import React from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";
import { getAppUrl } from "@repo/url-utils";

export function HeroSection() {
	const cloudUrl = getAppUrl("cloud");
	const authUrl = getAppUrl("auth");

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

			<div className="flex items-center justify-center flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
				<Button size="default" asChild>
					<Link href={cloudUrl}>Join waitlist</Link>
				</Button>
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
