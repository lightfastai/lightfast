import React from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/ui/button";
import { getAppUrl } from "@repo/url-utils";

export function HeroSection() {
	const cloudUrl = getAppUrl("cloud");
	const authUrl = getAppUrl("auth");

	return (
		<div className="text-center space-y-6 justify-center sm:space-y-8 flex flex-col items-center">
			<h1 className="text-xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl max-w-2xl">
				Cloud-native infrastructure for modern AI-agents
			</h1>

			<div className="space-y-3 sm:space-y-4">
				<p className="mx-auto max-w-3xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
					Lightfast is the cloud-native agent execution platform.
				</p>

				<p className="mx-auto max-w-3xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
					Start your project with state-machine orchestration, resource
					scheduling, built-in security, human-in-the-loop workflows, and
					infinitely scalable agent execution.
				</p>
			</div>

			<div className="flex items-center justify-center flex-row w-full gap-3 sm:gap-4 pt-2 sm:pt-0">
				<Button size="lg" asChild>
					<Link href={cloudUrl}>Join waitlist</Link>
				</Button>
				<Button size="lg" variant="outline" asChild>
					<Link href={`${authUrl}/sign-in`}>Sign in</Link>
				</Button>
			</div>
		</div>
	);
}

