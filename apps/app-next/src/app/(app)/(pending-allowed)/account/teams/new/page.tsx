import { Icons } from "@repo/ui/components/icons";
import { TeamNameForm } from "./_components/team-name-form";

export const dynamic = "force-dynamic";

export default function CreateTeamPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        {/* Logo */}
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        <div className="space-y-4">
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Create your team
          </h1>
          <TeamNameForm />
        </div>
      </div>
    </div>
  );
}
