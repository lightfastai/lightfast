"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

export function LandingHeader() {
	return (
		<header className="w-full bg-background px-4 sm:px-6 lg:px-8">
			<div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto h-14 flex items-center justify-between">
					{/* Logo */}
					<div className="flex items-center gap-2">
						<Link href="/" className="flex items-center space-x-2">
							<span className="font-bold text-xl">Deus</span>
						</Link>
					</div>

					{/* Navigation */}
					<nav className="hidden md:flex items-center gap-6">
						<Link
							href="#features"
							className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							Features
						</Link>
					</nav>

					{/* Auth buttons */}
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="sm" asChild>
							<Link href="/sign-in">Log in</Link>
						</Button>
						<Button size="sm" asChild>
							<Link href="/sign-up">Sign up</Link>
						</Button>
					</div>
				</div>
		</header>
	);
}
