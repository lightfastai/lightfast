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
		<div className="min-h-screen bg-background relative">
			{/* Header - Absolute positioned */}
			<header className="absolute top-0 left-0 right-0 z-10 py-4 px-4">
				<div className="flex items-center justify-between">
					<Link href={siteConfig.url} className="flex items-center px-2">
						<Icons.logoShort className="w-7 h-5 text-foreground" />
					</Link>
					<div className="flex items-center gap-4">
						<Button variant="outline" size="sm" asChild>
							<Link href={isSignUpPage ? "/sign-in" : "/sign-up"}>
								{isSignUpPage ? "Sign In" : "Sign Up"}
							</Link>
						</Button>
					</div>
				</div>
			</header>

			{/* Main Content - Full height centered */}
			<main className="min-h-screen flex items-center justify-center px-6 py-12">
				<div className="w-full max-w-xs">{children}</div>
			</main>
		</div>
	);
}
