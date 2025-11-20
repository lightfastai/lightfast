import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	// Parent org layout handles membership; settings layout handles admin role
	const { slug } = await params;
	const { orgId } = await auth();

	if (!orgId) {
		notFound();
	}

	return (
		<Suspense fallback={<GeneralSettingsSkeleton />}>
			<GeneralSettings slug={slug} />
		</Suspense>
	);
}

async function GeneralSettings({ slug }: { slug: string }) {
	// TODO: Fetch organization details from tRPC
	// const org = await trpc.organization.getBySlug.query({ slug });

	return (
		<div className="space-y-8">
			{/* Organization Name Section */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Workspace Name</h2>
					<p className="text-sm text-muted-foreground mt-1">
						This is your workspace's visible name within Lightfast.
					</p>
				</div>

				<div className="w-full space-y-4">
					<div>
						<Input
							type="text"
							value={slug}
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

			{/* Additional Settings */}
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold text-foreground">Additional Settings</h2>
					<p className="text-sm text-muted-foreground mt-1">
						More workspace configuration options coming soon.
					</p>
				</div>
			</div>
		</div>
	);
}

function GeneralSettingsSkeleton() {
	return (
		<div className="space-y-8">
			<div className="space-y-4">
				<div>
					<Skeleton className="h-7 w-48" />
					<Skeleton className="h-4 w-72 mt-2" />
				</div>
				<div className="w-full space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-4 w-56" />
					<div className="flex justify-end">
						<Skeleton className="h-9 w-16" />
					</div>
				</div>
			</div>
		</div>
	);
}
