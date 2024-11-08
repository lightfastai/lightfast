import { redirect } from "next/navigation";
import { TriangleRightIcon } from "lucide-react";
import { ProviderSchema } from "node_modules/@repo/auth/src/config";

import { auth, signIn } from "@repo/auth";
import { GitHubLogo } from "@repo/ui/components/logo";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";

export default async function Page() {
  const session = await auth();

  if (session) {
    redirect("/");
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex w-full flex-col items-center gap-12 overflow-hidden">
        <Card className="max-w-3xl">
          <CardHeader className="flex flex-col items-center space-y-2">
            <TriangleRightIcon className="h-12 w-12" />
            <h3 className="text-3xl font-semibold text-foreground">
              Continue with Tetra
            </h3>
            <p className="text-md text-muted-foreground">
              Sign in to Tetra to continue.
            </p>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4">
              <Button
                type="submit"
                formAction={async () => {
                  "use server";
                  await signIn(ProviderSchema.Enum.github);
                }}
              >
                <GitHubLogo />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
