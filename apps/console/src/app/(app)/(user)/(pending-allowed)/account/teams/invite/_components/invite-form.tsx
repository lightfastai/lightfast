import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { SubmitButton } from "../../_components/submit-button";
import { inviteTeammates } from "../_actions/invite-teammates";

interface InviteFormProps {
  teamSlug: string;
}

export function InviteForm({ teamSlug }: InviteFormProps) {
  return (
    <form action={inviteTeammates} className="space-y-4">
      <input name="teamSlug" type="hidden" value={teamSlug} />

      <div className="space-y-3">
        <Input
          autoFocus
          name="email1"
          placeholder="teammate@company.com"
          type="email"
        />
        <Input name="email2" placeholder="teammate@company.com" type="email" />
        <Input name="email3" placeholder="teammate@company.com" type="email" />
      </div>

      <SubmitButton label="Send Invites" pendingLabel="Sending..." />
      <Button asChild className="w-full" variant="ghost">
        <Link href={`/new?teamSlug=${teamSlug}`}>Skip for now</Link>
      </Button>
    </form>
  );
}
