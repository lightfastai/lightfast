import React from "react";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";
import { cloudUrl } from "~/lib/related-projects";

const wwwUrl = process.env.NODE_ENV === 'development'
	? 'http://localhost:4101'
	: 'https://lightfast.ai';

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {

	return (
		<>
			<SignedOut>
				<RedirectToTasks />
			</SignedOut>
			<div className="min-h-screen bg-background flex flex-col">
				{/* Header - Fixed height matching apps/chat */}
				<header className="h-14 flex items-center justify-between app-container bg-background">
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="lg" asChild>
							<Link href={wwwUrl} className="flex items-center">
								<Icons.logoShort className="text-foreground size-7" />
							</Link>
						</Button>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="lg" asChild>
							<Link href={cloudUrl}>Join the waitlist</Link>
						</Button>
					</div>
				</header>

				{/* Main Content - Flex grow to fill remaining space */}
				<main className="flex-1 flex items-center justify-center p-4">
					<div className="w-full max-w-xs">{children}</div>
				</main>
			</div>
		</>
	);
}
