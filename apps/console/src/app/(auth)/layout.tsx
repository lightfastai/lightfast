"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const isSignUpPage = pathname.includes("/sign-up");

	return (
		<div className="dark min-h-screen bg-background flex flex-col relative">
			{/* Mobile/Tablet header - relative positioning */}
			<header className="lg:hidden relative h-14 flex items-center justify-between px-4 bg-background border-b border-border/50 z-10">
				{/* Left side - Logo */}
				<div className="flex items-center">
					<Button variant="ghost" size="xs" asChild>
						<Link href="/">
							<Icons.logoShort className="h-4 w-auto text-foreground" />
						</Link>
					</Button>
				</div>

				{/* Right side - Sign in/up button */}
				<div className="flex items-center gap-2">
					<Button variant="outline" size="xs" asChild>
						<Link href={isSignUpPage ? "/sign-in" : "/sign-up"}>
							{isSignUpPage ? "Sign In" : "Sign Up"}
						</Link>
					</Button>
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Left side - Logo only */}
			<div className="hidden lg:flex absolute top-0 left-0 h-14 items-center pl-2 z-10 w-fit">
				<Button variant="ghost" size="lg" asChild>
					<Link href="/">
						<Icons.logo className="size-22 text-foreground" />
					</Link>
				</Button>
			</div>

			{/* Desktop Right side - Sign in/up button */}
			<div className="hidden lg:flex absolute top-0 right-0 h-14 items-center pr-2 z-10 w-fit">
				<Button variant="ghost" size="lg" asChild>
					<Link href={isSignUpPage ? "/sign-in" : "/sign-up"}>
						<span className="text-md font-semibold">
							{isSignUpPage ? "Sign In" : "Sign Up"}
						</span>
					</Link>
				</Button>
			</div>

			{/* Main Content - Flex grow to fill remaining space */}
			<main className="flex-1 flex items-center justify-center p-4 lg:pt-14">
				<div className="w-full max-w-xs">{children}</div>
			</main>
		</div>
	);
}
