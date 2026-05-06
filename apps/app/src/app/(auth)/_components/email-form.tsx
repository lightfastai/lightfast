import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { initiateSignIn } from "../_actions/sign-in";
import { initiateSignUp } from "../_actions/sign-up";

interface EmailFormProps {
  action: "sign-in" | "sign-up";
  redirectUrl?: string | null;
  ticket?: string | null;
}

export function EmailForm({ action, redirectUrl, ticket }: EmailFormProps) {
  const serverAction = action === "sign-in" ? initiateSignIn : initiateSignUp;

  return (
    <form action={serverAction} className="space-y-4">
      {ticket && <input name="ticket" type="hidden" value={ticket} />}
      {redirectUrl && (
        <input name="redirect_url" type="hidden" value={redirectUrl} />
      )}
      <Input
        className="bg-background dark:bg-background"
        name="email"
        placeholder="Email Address"
        required
        size="lg"
        type="email"
      />
      <Button className="w-full" size="lg" type="submit">
        Continue with Email
      </Button>
    </form>
  );
}
