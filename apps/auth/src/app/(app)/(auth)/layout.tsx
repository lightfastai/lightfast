"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { siteConfig } from "@repo/lightfast-config";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const isSignUpPage = pathname.includes("/sign-up");

	return (
		<div className="min-h-screen bg-background flex flex-col">
			{/* Header - Fixed height matching apps/chat */}
			<header className="h-14 flex items-center justify-between app-container bg-background">
				<Link href={siteConfig.url} className="flex items-center">
					<Icons.logoShort className="w-7 h-5 text-foreground" />
				</Link>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link href={isSignUpPage ? "/sign-in" : "/sign-up"}>
							{isSignUpPage ? "Sign In" : "Sign Up"}
						</Link>
					</Button>
				</div>
			</header>

			{/* Main Content - Flex grow to fill remaining space */}
			<main className="flex-1 flex items-center justify-center p-4">
				<div className="w-full max-w-xs">{children}</div>
			</main>
		</div>
	);
}
