"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";

export default function Page() {
  return (
    <div className="bg-background flex h-screen w-screen items-center justify-center">
      <div className="flex w-full flex-col items-center gap-12 overflow-hidden">
        <SignIn.Root>
          <Clerk.Loading>
            {(isGlobalLoading) => (
              <SignIn.Step name="start" asChild>
                <Card className="w-96">
                  <CardHeader className="border-b">
                    <header className="text-center">
                      <Icons.logo className="text-primary mx-auto size-4" />
                      <h1 className="text-primary mt-4 font-mono text-xs font-medium tracking-widest uppercase">
                        CODENAME: Lightfast App
                      </h1>
                    </header>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Clerk.Connection
                      name="github"
                      asChild
                      className="w-full space-x-3"
                    >
                      <Button
                        variant="outline"
                        type="button"
                        disabled={isGlobalLoading}
                      >
                        <Clerk.Loading scope="provider:github">
                          {(isLoading) =>
                            isLoading ? (
                              <Icons.spinner className="size-4 animate-spin" />
                            ) : (
                              <>
                                <Icons.gitHub className="size-3" />
                                Login with
                                <span className="bg-gradient-to-r from-sky-400 via-fuchsia-400 to-orange-400 bg-clip-text text-transparent">
                                  GitHub
                                </span>
                              </>
                            )
                          }
                        </Clerk.Loading>
                      </Button>
                    </Clerk.Connection>
                    <p className="text-center text-sm text-zinc-500">
                      No account?{" "}
                      <Clerk.Link
                        navigate="sign-up"
                        className="text-primary font-medium decoration-zinc-950/20 underline-offset-4 outline-none hover:text-zinc-700 hover:underline focus-visible:underline"
                      >
                        Create an account
                      </Clerk.Link>
                    </p>
                  </CardContent>
                </Card>
              </SignIn.Step>
            )}
          </Clerk.Loading>
        </SignIn.Root>
      </div>
    </div>
  );
}
