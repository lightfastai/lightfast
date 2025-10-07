"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

export function LandingHeader() {
	return (
		<header className="w-full bg-background px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
				{/* Logo */}
				<div className="flex items-center gap-2">
					<Link href="/" className="flex items-center space-x-2">
						<span className="font-bold text-xl">Deus</span>
					</Link>
				</div>

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
