import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Building2 } from "lucide-react";

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
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Building2 className="h-5 w-5" />
						General Settings
					</CardTitle>
					<CardDescription>
						Manage your organization's basic information
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-4">
						<div>
							<h3 className="text-sm font-medium mb-2">Organization Name</h3>
							<p className="text-sm text-muted-foreground">{slug}</p>
						</div>

						<div className="pt-4 border-t">
							<p className="text-sm text-muted-foreground">
								Additional organization settings coming soon...
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function GeneralSettingsSkeleton() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Building2 className="h-5 w-5" />
						General Settings
					</CardTitle>
					<CardDescription>
						Manage your organization's basic information
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-16 w-full" />
				</CardContent>
			</Card>
		</div>
	);
}
