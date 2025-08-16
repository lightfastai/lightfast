"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { BookOpen } from "lucide-react";
import { TemplateCard } from "./template-card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@repo/ui/components/ui/carousel";
import NextjsOriginal from "react-devicons/nextjs/original";
import ReactOriginal from "react-devicons/react/original";

const templates = [
	{
		title: "Next.js AI Chatbot",
		description:
			"Production-ready AI chatbot with streaming responses, conversation history, and rate limiting built with Next.js and Vercel AI SDK.",
		icons: [
			<NextjsOriginal size="1.5rem" className="text-muted-foreground" />,
			<div className="text-lg font-bold text-muted-foreground">AI</div>,
			<ReactOriginal size="1.5rem" className="text-muted-foreground" />,
		],
		href: "https://github.com/lightfastai/lightfast/tree/main/examples/nextjs-ai-chatbot",
	},
	{
		title: "Braintrust Integration",
		description:
			"Complete Braintrust setup for AI evaluation, monitoring, and prompt management with automatic logging and scoring.",
		icons: [
			<div className="text-lg font-bold text-muted-foreground">BT</div>,
			<NextjsOriginal size="1.5rem" className="text-muted-foreground" />,
		],
		href: "https://github.com/lightfastai/lightfast/tree/main/examples/braintrust-integration",
	},
	{
		title: "Agent Workflow Starter",
		description:
			"State-machine orchestration template with resource scheduling, error handling, and automatic retry logic for complex agent workflows.",
		icons: [
			<div className="text-xl text-muted-foreground">⚡</div>,
			<ReactOriginal size="1.5rem" className="text-muted-foreground" />,
			<div className="text-lg font-bold text-muted-foreground">SM</div>,
		],
		href: "https://github.com/lightfastai/lightfast/tree/main/examples/agent-workflow-starter",
	},
	{
		title: "Human-in-the-Loop Dashboard",
		description:
			"Interactive dashboard for human review and approval workflows with real-time notifications and task queue management.",
		icons: [
			<div className="text-xl text-muted-foreground">👤</div>,
			<NextjsOriginal size="1.5rem" className="text-muted-foreground" />,
		],
		href: "https://github.com/lightfastai/lightfast/tree/main/examples/human-in-the-loop-dashboard",
	},
	{
		title: "Multi-Agent System",
		description:
			"Coordinate multiple AI agents with shared memory, task delegation, and inter-agent communication for complex problem solving.",
		icons: [
			<div className="text-xl text-muted-foreground">🤖</div>,
			<div className="text-xl text-muted-foreground">🔄</div>,
			<div className="text-xl text-muted-foreground">🤖</div>,
		],
		href: "https://github.com/lightfastai/lightfast/tree/main/examples/multi-agent-system",
	},
	{
		title: "Browser Automation Agent",
		description:
			"Web scraping and automation agent with Browserbase integration, screenshot capture, and intelligent element selection.",
		icons: [
			<div className="text-xl text-muted-foreground">🌐</div>,
			<ReactOriginal size="1.5rem" className="text-muted-foreground" />,
		],
		href: "https://github.com/lightfastai/lightfast/tree/main/examples/browser-automation-agent",
	},
];

export function TemplatesSection() {
	return (
		<>
			{/* Header */}
			<div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12">
				<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
					Start building in seconds
				</h2>
				<p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
					Kickstart your next project with templates built by us and our
					community.
				</p>

				{/* Action Buttons */}
				<div className="flex flex-row gap-3 sm:gap-4 justify-center items-center pt-2 sm:pt-4">
					<Button variant="outline" size="default" asChild>
						<Link href="https://github.com/lightfastai/lightfast/tree/main/examples" target="_blank" rel="noopener noreferrer">
							View all examples
						</Link>
					</Button>
					<Button variant="default" size="default" className="gap-2" asChild>
						<Link href="/docs">
							<BookOpen className="size-3 sm:size-4" />
							Docs
						</Link>
					</Button>
				</div>
			</div>

			{/* Mobile Carousel */}
			<div className="block lg:hidden">
				<Carousel
					opts={{
						align: "start",
						loop: true,
					}}
					className="w-full"
				>
					<CarouselContent className="-ml-2 sm:-ml-3 md:-ml-4">
						{templates.map((template, index) => (
							<CarouselItem key={index} className="pl-2 sm:pl-3 md:pl-4 basis-full sm:basis-1/2 md:basis-1/2">
								<TemplateCard
									title={template.title}
									description={template.description}
									icons={template.icons}
									href={template.href}
								/>
							</CarouselItem>
						))}
					</CarouselContent>
					<CarouselPrevious className="left-1 sm:left-2" />
					<CarouselNext className="right-1 sm:right-2" />
				</Carousel>
			</div>

			{/* Desktop Grid */}
			<div className="hidden lg:grid lg:grid-cols-3 gap-6">
				{templates.map((template, index) => (
					<TemplateCard
						key={index}
						title={template.title}
						description={template.description}
						icons={template.icons}
						href={template.href}
					/>
				))}
			</div>
		</>
	);
}

