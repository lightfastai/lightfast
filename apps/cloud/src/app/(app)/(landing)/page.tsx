import type { Metadata } from "next";

import { WaitlistForm } from "./_components/(waitlist)/waitlist-form";

export const metadata: Metadata = {
  title: "Lightfast Cloud - Enterprise Agent Execution Platform | Join Waitlist",
  description: "Join the waitlist for Lightfast Cloud - the enterprise-grade platform for deploying and scaling AI agents in production. Advanced orchestration, security, and monitoring for mission-critical workloads.",
  keywords: [
    "Lightfast Cloud waitlist",
    "enterprise AI platform",
    "agent deployment platform", 
    "production AI agents",
    "enterprise agent orchestration",
    "AI infrastructure platform",
    "cloud agent platform",
    "early access AI platform"
  ],
  openGraph: {
    title: "Join Lightfast Cloud Waitlist - Enterprise Agent Platform",
    description: "Get early access to the enterprise-grade platform for deploying AI agents in production.",
    url: "https://cloud.lightfast.ai",
  },
  twitter: {
    title: "Join Lightfast Cloud Waitlist - Enterprise Agent Platform", 
    description: "Get early access to the enterprise-grade platform for deploying AI agents in production.",
  },
  alternates: {
    canonical: "https://cloud.lightfast.ai",
  },
};

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
			</div>
		</div>
	);
}
