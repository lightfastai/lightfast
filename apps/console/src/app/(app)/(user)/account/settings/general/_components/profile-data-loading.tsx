import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Button } from "@repo/ui/components/ui/button";

/**
 * Loading skeleton for profile data
 * Matches the exact layout of ProfileDataDisplay
 */
export function ProfileDataLoading() {
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
					<Skeleton className="h-20 w-20 rounded-full" />
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
						<Skeleton className="h-10 w-full" />
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

			{/* Username Section */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Username</h2>
					<p className="text-sm text-muted-foreground mt-1">
						This is your URL namespace within Lightfast.
					</p>
				</div>

				<div className="w-full space-y-4">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">lightfast.com/</span>
						<Skeleton className="h-10 flex-1" />
					</div>

					<p className="text-sm text-muted-foreground">
						Please use 48 characters at maximum.
					</p>

					<div className="flex justify-end">
						<Button disabled variant="secondary">
							Save
						</Button>
					</div>
				</div>
			</div>

			{/* Email Section */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Email</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Your primary email address. Manage emails in your sources settings.
					</p>
				</div>

				<div className="w-full">
					<Skeleton className="h-10 w-full" />
				</div>
			</div>
		</div>
	);
}
