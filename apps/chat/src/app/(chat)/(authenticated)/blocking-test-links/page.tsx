// Test page to compare different Link implementations
"use client";

import Link from "next/link";
import { ActiveMenuItem } from "~/components/sidebar/active-menu-item";
import { TestDirectLink } from "~/components/sidebar/test-direct-link";
import { SidebarMenuItem } from "@repo/ui/components/ui/sidebar";

export default function BlockingTestLinksPage() {
	const testSessions = [
		{ id: "session-1", title: "Test Session 1" },
		{ id: "session-2", title: "Test Session 2" },
		{ id: "new", title: "New Session" },
	];

	return (
		<div className="p-8 space-y-8">
			<h1 className="text-2xl font-bold">Link Implementation Comparison</h1>
			
			<div className="space-y-4">
				<div>
					<h2 className="text-lg font-semibold mb-2">1. Standard Next.js Link (no wrapper)</h2>
					<div className="space-y-1">
						{testSessions.map((session) => (
							<Link 
								key={session.id}
								href={`/${session.id}`}
								prefetch={true}
								className="block p-2 hover:bg-muted rounded transition-colors"
							>
								→ {session.title}
							</Link>
						))}
					</div>
				</div>

				<div>
					<h2 className="text-lg font-semibold mb-2">2. Direct Link Component (no asChild)</h2>
					<div className="space-y-1">
						{testSessions.map((session) => (
							<TestDirectLink 
								key={session.id}
								sessionId={session.id}
								href={`/${session.id}`}
							>
								→ {session.title}
							</TestDirectLink>
						))}
					</div>
				</div>

				<div>
					<h2 className="text-lg font-semibold mb-2">3. ActiveMenuItem (with asChild)</h2>
					<div className="space-y-1">
						{testSessions.map((session) => (
							<SidebarMenuItem key={session.id}>
								<ActiveMenuItem
									sessionId={session.id}
									href={`/${session.id}`}
									prefetch={true}
								>
									→ {session.title}
								</ActiveMenuItem>
							</SidebarMenuItem>
						))}
					</div>
				</div>
			</div>

			<div className="mt-8 p-4 bg-muted rounded text-sm">
				<p>Test instructions:</p>
				<ol className="list-decimal list-inside space-y-1 mt-2">
					<li>Try each link type above</li>
					<li>Hard refresh on the target page</li>
					<li>Navigate back here</li>
					<li>Try navigating back to the hard-refreshed page</li>
					<li>See which implementation causes blocking</li>
				</ol>
			</div>
		</div>
	);
}