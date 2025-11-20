import { TeamHeader } from "./_components/team-header";
import { TeamFormProvider } from "./_components/team-form-provider";
import { TeamNameInput } from "./_components/team-name-input";
import { CreateTeamButton } from "./_components/create-team-button";

/**
 * Team Creation Page
 *
 * Server component with client islands for optimal SSR performance.
 *
 * Architecture:
 * - Server components: Static header, page structure
 * - Client islands: Interactive form, input validation, mutation button
 * - Form state: Shared via TeamFormProvider context
 * - URL persistence: teamName synced via nuqs
 *
 * User Flow:
 * 1. Enter team name (auto-normalized to lowercase alphanumeric + hyphens)
 * 2. Real-time validation with inline error messages
 * 3. Create team via /api/organizations/create
 * 4. Set active organization in Clerk session
 * 5. Redirect to /new?teamSlug={slug} for workspace creation
 *
 * URL Parameters:
 * - teamName: Pre-fill team name (e.g., ?teamName=acme-inc)
 *
 * Design: Clean, minimal form following Vercel's onboarding aesthetic.
 */
export default async function CreateTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ teamName?: string }>;
}) {
  // Read search params for initial form state
  const params = await searchParams;
  const initialTeamName = params.teamName || "";

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-8 w-full overflow-y-auto">
      <div className="w-full max-w-md">
        {/* Static Header (Server Component) */}
        <TeamHeader />

        {/* Form with Client Islands */}
        <TeamFormProvider initialTeamName={initialTeamName}>
          <div className="space-y-6">
            {/* Client Island: Team Name Input */}
            <TeamNameInput />

            {/* Client Island: Create Button */}
            <CreateTeamButton />
          </div>
        </TeamFormProvider>
      </div>
    </div>
  );
}
