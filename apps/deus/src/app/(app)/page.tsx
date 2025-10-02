import Link from "next/link";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
} from "@repo/ui/components/ui/card";
import { Textarea } from "@repo/ui/components/ui/textarea";

import { UserDropdownMenu } from "~/components/user-dropdown-menu";

export default function HomePage() {
	return (
		<div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0b0b0f] via-[#050506] to-[#010104] text-foreground">
			<header className="flex items-center justify-between px-6 py-6">
				<Link
					href="/"
					className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] backdrop-blur transition hover:border-white/30 hover:bg-white/[0.08]"
				>
					<span className="sr-only">Lightfast home</span>
					<Icons.logoShort className="h-4 w-auto text-white" />
				</Link>
				<UserDropdownMenu />
			</header>

			<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-16 pt-6 text-center">
				<h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
					What should we orchestrate next?
				</h1>
				<p className="mt-4 max-w-2xl text-lg text-muted-foreground">
					Describe what you want Deus to build and we will map the workflow, connect the tools, and generate the automation for you.
				</p>
				<Card className="mt-12 w-full max-w-3xl border-white/10 bg-white/[0.03] text-left backdrop-blur">
					<CardContent className="space-y-4 pt-6">
						<label htmlFor="home-chat-input" className="sr-only">
							Describe your workflow
						</label>
						<Textarea
							id="home-chat-input"
							placeholder="Describe a workflow, ask a question, or drop in a task for Deus to handle..."
							className="min-h-[220px] resize-none border-transparent bg-transparent text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40"
						/>
					</CardContent>
					<CardFooter className="flex items-center justify-end gap-2 border-t border-white/10 bg-white/[0.02] px-6 py-4">
						<Button
							variant="outline"
							className="border-white/10 bg-transparent text-muted-foreground hover:border-white/20 hover:text-foreground"
						>
							Clear
						</Button>
						<Button className="bg-primary text-primary-foreground hover:bg-primary/80">
							Start chat
						</Button>
					</CardFooter>
				</Card>
			</main>
		</div>
	);
}
