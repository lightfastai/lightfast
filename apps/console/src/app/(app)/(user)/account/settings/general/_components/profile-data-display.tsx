"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";

/**
 * Profile Data Display
 *
 * Client component that fetches and displays user profile data.
 * Uses useSuspenseQuery with prefetched server data.
 *
 * Architecture:
 * - Server prefetches data in page.tsx
 * - HydrateClient passes data to client
 * - This component uses cached data (no client-side fetch)
 * - refetchOnMount/refetchOnWindowFocus disabled to prevent unnecessary fetches
 */
export function ProfileDataDisplay() {
	const trpc = useTRPC();

	const { data: profile } = useSuspenseQuery({
		...trpc.account.profile.get.queryOptions(),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 10 * 60 * 1000, // 10 minutes - user profile rarely changes
	});

	// Get initials for avatar fallback
	const initials = profile.fullName
		? profile.fullName
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2)
		: "U";

	return (
		<div className="space-y-8">
			{/* Avatar Section */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Avatar</h2>
					<p className="text-sm text-muted-foreground mt-1">
						This is your avatar.
					</p>
					<p className="text-sm text-muted-foreground">
						Click on the avatar to upload a custom one from your files.
					</p>
				</div>

				<div className="flex items-center gap-4">
					<Avatar className="h-20 w-20">
						<AvatarImage src={profile.imageUrl} alt={profile.fullName ?? "User"} />
						<AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl">
							{initials}
						</AvatarFallback>
					</Avatar>
				</div>

				<p className="text-sm text-muted-foreground">
					An avatar is optional but strongly recommended.
				</p>
			</div>

			{/* Display Name Section */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Display Name</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Please enter your full name, or a display name you are comfortable with.
					</p>
				</div>

				<div className="w-full space-y-4">
					<div>
						<Input
							type="text"
							value={profile.fullName ?? ""}
							disabled
							className="bg-muted/50"
						/>
					</div>

					<p className="text-sm text-muted-foreground">
						Please use 32 characters at maximum.
					</p>

					<div className="flex justify-end">
						<Button disabled variant="secondary">
							Save
						</Button>
					</div>
				</div>
			</div>

			{/* Email Section (Read-only) */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Email</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Your primary email address. Manage emails in your{" "}
						<Link href="/account/settings/sources" className="text-foreground hover:underline">
							sources settings
						</Link>.
					</p>
				</div>

				<div className="w-full">
					<Input
						type="email"
						value={profile.primaryEmailAddress ?? ""}
						disabled
						className="bg-muted/50"
					/>
				</div>
			</div>
		</div>
	);
}
