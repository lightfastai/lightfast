"use client";

import { useSearchParams } from "next/navigation";

import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

import { env } from "~/env";

export default function EmailAuthRoute() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <form
            method="post"
            className="grid gap-4"
            action={`${env.NEXT_PUBLIC_OPENAUTH_ISSUER_URL}/email/authorize`}
          >
            {error === "invalid_claim" && (
              <FormAlert message={"Invalid email address"} />
            )}
            <input type="hidden" name="action" value="request" />
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                type="email"
                name="email"
                id="email"
                autoFocus
                autoComplete="email"
                placeholder="Email address"
              />
            </div>
            <Button type="submit">Continue</Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-sm">
            We&apos;ll send you a code to your email address
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function FormAlert({ message }: { message: string }) {
  return (
    <div
      data-component="alert"
      className="mb-4 rounded border border-red-300 bg-red-100 p-4 text-red-700"
    >
      {message}
    </div>
  );
}
