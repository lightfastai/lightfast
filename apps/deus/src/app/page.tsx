import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { LandingHeader } from "~/components/landing/landing-header";
import { FeatureCard } from "~/components/landing/feature-card";
import {
	WorkflowIcon,
	GithubIcon,
	NetworkIcon,
	Users2Icon,
	ArrowRightIcon,
} from "lucide-react";

export default function LandingPage() {
	return (
		<div className="min-h-screen bg-background">
			<LandingHeader />

			{/* Hero Section */}
			<section className="py-20 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					<div className="mx-auto max-w-4xl text-center">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							Describe workflows in plain English. Deus builds them.
						</h1>
						<p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
							AI-native orchestration that maps workflows, connects tools, and generates
							automation from your description. No visual editors, no configuration files.
							Just tell Deus what you need.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
							<Button size="lg" asChild>
								<Link href="/app">Connect GitHub</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="#features">See how it works</Link>
							</Button>
						</div>
						<p className="mt-4 text-sm text-muted-foreground">
							Free for individuals • Pro plans for teams
						</p>
					</div>
				</div>
			</section>

			{/* How It Works Section */}
			<section className="py-20 sm:py-24 lg:py-32 border-t border-border/50 bg-muted/30 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					<div className="mx-auto max-w-3xl text-center mb-12">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
							How it works
						</h2>
						<p className="text-lg text-muted-foreground">
							Three steps from idea to automation
						</p>
					</div>
					<div className="mx-auto max-w-4xl">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
							<div className="flex flex-col items-center text-center">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mb-4 text-lg font-semibold">
									1
								</div>
								<h3 className="font-semibold mb-2">Describe your workflow</h3>
								<p className="text-sm text-muted-foreground">
									Tell Deus what you need in plain English. "Set up CI/CD for this repo" or "Automate our release process"
								</p>
							</div>
							<div className="flex flex-col items-center text-center relative">
								<ArrowRightIcon className="hidden md:block absolute -left-8 top-6 h-6 w-6 text-muted-foreground/40 -rotate-0" />
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mb-4 text-lg font-semibold">
									2
								</div>
								<h3 className="font-semibold mb-2">Deus maps the workflow</h3>
								<p className="text-sm text-muted-foreground">
									AI understands your intent, identifies required tools, and generates the workflow steps automatically
								</p>
							</div>
							<div className="flex flex-col items-center text-center relative">
								<ArrowRightIcon className="hidden md:block absolute -left-8 top-6 h-6 w-6 text-muted-foreground/40 -rotate-0" />
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground mb-4 text-lg font-semibold">
									3
								</div>
								<h3 className="font-semibold mb-2">Automation runs</h3>
								<p className="text-sm text-muted-foreground">
									Workflows execute across your tools with context-aware coordination and built-in error handling
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-20 sm:py-24 lg:py-32 border-t border-border/50 px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-5xl lg:max-w-6xl xl:max-w-7xl">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
						<FeatureCard
							icon={<WorkflowIcon className="h-10 w-10" />}
							title="Natural language workflows"
							description="Describe what you want in plain English. Deus maps the workflow, identifies required tools, and generates the automation—no drag-and-drop builders needed."
						/>
						<FeatureCard
							icon={<GithubIcon className="h-10 w-10" />}
							title="GitHub-native integration"
							description="Connect your GitHub org to get started. Deus understands your repos, PRs, and issues. Coordinate workflows across your entire development lifecycle."
						/>
						<FeatureCard
							icon={<NetworkIcon className="h-10 w-10" />}
							title="MCP-powered connections"
							description="Every tool speaks Model Context Protocol. Access 500+ integrations from APIs to CLIs, databases to internal systems. If it has an API, Deus can orchestrate it."
						/>
						<FeatureCard
							icon={<Users2Icon className="h-10 w-10" />}
							title="Built for dev teams"
							description="Organization-based collaboration, secure sandboxed execution, audit logs, and human-in-the-loop for critical actions. Production-ready from day one."
						/>
					</div>
				</div>
			</section>
		</div>
	);
}
