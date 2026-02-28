import { Icons } from "@repo/ui/components/icons";
import { TeamFormProvider } from "./_components/team-form-provider";
import { TeamNameInput } from "./_components/team-name-input";
import { CreateTeamButton } from "./_components/create-team-button";

export default async function CreateTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ teamName?: string }>;
}) {
  const params = await searchParams;
  const initialTeamName = params.teamName ?? "";

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Logo */}
        <div className="rounded-sm bg-card p-3 w-fit">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl pb-4 font-pp font-medium text-foreground">
          Create your team
        </h1>

        {/* Form */}
        <TeamFormProvider initialTeamName={initialTeamName}>
          <div className="space-y-4">
            <TeamNameInput />
            <CreateTeamButton />
          </div>
        </TeamFormProvider>
      </div>
    </div>
  );
}
