import { HydrateClient } from "@repo/console-trpc/server";

export const dynamic = "force-dynamic";
import { WorkspaceHeader } from "./_components/workspace-header";
import { OrganizationSelector } from "./_components/organization-selector";
import { WorkspaceNameInput } from "./_components/workspace-name-input";
import { CreateWorkspaceButton } from "./_components/create-workspace-button";
import { NewWorkspaceInitializer } from "./_components/new-workspace-initializer";

/**
 * Workspace Creation Page
 *
 * Server component with client islands for optimal SSR performance.
 *
 * Architecture:
 * - Server components: Static headers, section labels, structure
 * - Client islands: Interactive forms, mutations, navigation
 * - Form state: Shared via WorkspaceFormProvider context
 * - URL persistence: teamSlug and workspaceName synced via nuqs
 *
 * Flow:
 * 1. User selects org + enters workspace name
 * 2. Create button creates workspace
 * 3. Redirects to /{slug}/{workspaceName}/sources/new for source connection
 *
 * URL Parameters:
 * - teamSlug: Hint for which org to pre-select
 * - workspaceName: Pre-fill workspace name
 */
export default async function NewWorkspacePage({
	searchParams,
}: {
	searchParams: Promise<{ teamSlug?: string; workspaceName?: string }>;
}) {
	const params = await searchParams;
	const teamSlugHint = params.teamSlug;
	const initialWorkspaceName = params.workspaceName ?? "";

	return (
		<main className="flex-1 flex items-start justify-center py-4">
			<div className="w-full space-y-4">
				{/* Static Header (Server Component) */}
				<WorkspaceHeader />

				{/* Form with Client Islands */}
				<HydrateClient>
					<NewWorkspaceInitializer
						teamSlugHint={teamSlugHint}
						initialWorkspaceName={initialWorkspaceName}
					>
						<div className="space-y-8">
							{/* Section 1: General */}
							<div className="flex gap-6">
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-foreground text-background font-semibold">
									1
								</div>
								<div className="flex-1 min-w-0 space-y-6">
									<div>
										<h2 className="text-xl font-semibold mb-4">
											General
										</h2>

										<div className="space-y-6">
											{/* Client Island: Organization Selector */}
											<OrganizationSelector />

											{/* Client Island: Workspace Name Input */}
											<WorkspaceNameInput />
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Client Island: Create Button */}
						<CreateWorkspaceButton />
					</NewWorkspaceInitializer>
				</HydrateClient>
			</div>
		</main>
	);
}
