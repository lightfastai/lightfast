import { Button } from "@repo/ui/components/ui/button";
import { currentUser } from "@vendor/clerk/server";
import Link from "next/link";
import { SignOutButton } from "../sign-out-button";

export default async function OrganizationNotFound() {
  const user = await currentUser();

  const emailAddress =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    user?.username ??
    "";

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl rounded-sm border border-border border-dashed p-10 text-center sm:p-16">
        <div className="mb-8 flex justify-center">
          <div className="relative h-20 w-20">
            <div className="h-20 w-20 rounded-full border-2 border-border" />
            <div className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          </div>
        </div>

        <h1 className="mb-5 font-bold text-7xl text-foreground">404</h1>
        <p className="mx-auto mb-6 max-w-sm text-muted-foreground text-sm">
          This team doesn't exist, or you don't have access to it.
        </p>

        {emailAddress && (
          <p className="mb-8 text-muted-foreground text-sm">
            You are logged in as {emailAddress}
          </p>
        )}

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="rounded-full" size="lg" variant="outline">
            <Link href="/account/welcome">Return Home</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
