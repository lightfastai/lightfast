import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { initiateSignIn } from "../_actions/sign-in";
import { initiateSignUp } from "../_actions/sign-up";

interface EmailFormProps {
  action: "sign-in" | "sign-up";
  ticket?: string | null;
}

export function EmailForm({ action, ticket }: EmailFormProps) {
  const serverAction = action === "sign-in" ? initiateSignIn : initiateSignUp;

  return (
    <form action={serverAction} className="space-y-4">
      {ticket && <input name="ticket" type="hidden" value={ticket} />}
      <Input
        className="h-12 bg-background dark:bg-background"
        name="email"
        placeholder="Email Address"
        required
        type="email"
      />
      <Button className="w-full" size="lg" type="submit">
        Continue with Email
      </Button>
    </form>
  );
}
