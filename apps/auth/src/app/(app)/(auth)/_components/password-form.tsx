import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { signInWithPassword } from "../_actions/sign-in-password";

export function PasswordForm() {
  return (
    <form action={signInWithPassword} className="space-y-4">
      <Input
        className="bg-background dark:bg-background"
        name="identifier"
        placeholder="Email or username"
        required
        size="lg"
        type="text"
      />
      <Input
        className="bg-background dark:bg-background"
        name="password"
        placeholder="Password"
        required
        size="lg"
        type="password"
      />
      <Button className="w-full" size="lg" type="submit">
        Sign in with Password
      </Button>
    </form>
  );
}
