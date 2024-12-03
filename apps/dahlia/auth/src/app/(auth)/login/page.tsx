import Link from "next/link";
import { redirect } from "next/navigation";
import { ProviderSchema } from "node_modules/@vendor/clerk/src/config";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { auth, signIn } from "@vendor/clerk";

export default async function Page() {
  const session = await auth();

  /**
   * If the user is already logged in, redirect to the home page.
   * @TODO: Redirect to the previous page instead of the home page.
   */
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex w-full flex-col items-center gap-12 overflow-hidden">
        <Card className="animate-fadeIn max-w-3xl">
          <CardHeader className="flex flex-col items-center space-y-2 border">
            <h3 className="text-3xl font-semibold text-foreground">
              Join Dahlia
            </h3>
            <p className="text-md text-muted-foreground">
              Create or sign in to Dahlia to start generating beautiful textures
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 py-4">
              <div className="animate-fadeIn">
                <form className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    formAction={async () => {
                      "use server";
                      await signIn(ProviderSchema.Enum.github);
                    }}
                  >
                    <Icons.gitHub className="mr-2 h-4 w-4" />
                    Continue with GitHub
                  </Button>
                </form>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link
                href="https://dahlia.art/legal/terms"
                className="underline"
                target="_blank"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="https://dahlia.art/legal/privacy"
                className="underline"
                target="_blank"
              >
                Privacy Policy
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
