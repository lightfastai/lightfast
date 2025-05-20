"use client";

import { useSearchParams } from "next/navigation";
import { MailIcon } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

export default function AuthenticationSelect() {
  const providers = useProviders();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Select Authentication</CardTitle>
          <CardDescription>
            Choose a method to authenticate your account. You can also use an
            existing account if you have one.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid w-full gap-4">
          {Object.entries(providers).map(([key, type]) => {
            const Icon = ProviderIcons[key];
            const url = new URL(`${key}/authorize`, "http://localhost:3001");
            return (
              <Button
                asChild
                variant="outline"
                className="relative w-full"
                key={key}
              >
                <a href={url.toString()}>
                  {Icon && <Icon className="size-5" />}
                  Continue with {DISPLAY[type] ?? type}
                </a>
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function useProviders() {
  const searchParams = useSearchParams();
  const providers = searchParams.get("providers");
  if (!providers) {
    throw new Response("No providers found", { status: 400 });
  }
  const parsedProviders = parseProviders(providers);
  return parsedProviders;
}

function parseProviders(providers: string) {
  try {
    return JSON.parse(providers) as Record<string, string>;
  } catch {
    throw new Response("Invalid providers", { status: 400 });
  }
}
const DISPLAY: Record<string, string> = {
  google: "Google",
  code: "Email",
} as const;

const ProviderIcons: Record<
  string,
  React.ComponentType<React.ComponentProps<"svg">>
> = {
  google: Icons.google,
  code: MailIcon,
} as const;
