import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { wwwUrl } from "~/lib/related-projects";

import { WaitlistForm } from "./_components/(waitlist)/waitlist-form";
import { createMetadata } from "@vendor/seo/metadata";

export const metadata: Metadata = createMetadata({
  title:
    "Lightfast Cloud - Enterprise Agent Execution Platform | Join Waitlist",
  description:
    "Join the waitlist for Lightfast Cloud - the enterprise-grade platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring for mission-critical workloads.",
  openGraph: {
    title: "Join Lightfast Cloud Waitlist - Enterprise Agent Platform",
    description:
      "Get early access to the enterprise-grade platform for deploying AI agents in production.",
    url: "https://cloud.lightfast.ai",
  },
  twitter: {
    title: "Join Lightfast Cloud Waitlist - Enterprise Agent Platform",
    description:
      "Get early access to the enterprise-grade platform for deploying AI agents in production.",
  },
  alternates: {
    canonical: "https://cloud.lightfast.ai",
  },
});

export default function HomePage() {
	return (
		<div className="h-full flex flex-col items-center justify-center px-6 py-12">
			<div className="space-y-16">
				<div className="max-w-md text-center">
					<h1 className="text-4xl font-bold mb-4">Build on Lightfast Cloud</h1>
					<p className="text-muted-foreground text-xs">
						Join the waitlist or sign in with your developer account to build
						with the Lightfast Cloud
					</p>
				</div>

				<div className="flex justify-center">
					<div className="w-full max-w-sm">
						<WaitlistForm />
					</div>
				</div>

				{/* Changelog section */}
				<div className="max-w-md mx-auto text-center border-t border-border pt-10">
					<h2 className="text-2xl font-semibold mb-2">Changelog</h2>
					<p className="text-sm text-muted-foreground mb-6">
						See what's new, improvements, and fixes across Lightfast.
					</p>
					<Button variant="outline" size="lg" asChild>
						<Link href={`${wwwUrl}/changelog`} target="_blank" rel="noopener noreferrer">
							View Changelog
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
