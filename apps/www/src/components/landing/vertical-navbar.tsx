"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { authUrl } from "~/lib/related-projects";

export function VerticalNavbar() {
  return (
    <nav className="flex flex-row items-center gap-4">
      <Tabs defaultValue="home">
        <TabsList>
          <TabsTrigger value="home" asChild>
            <Link href="/">Home</Link>
          </TabsTrigger>

          <TabsTrigger value="pricing" asChild>
            <Link href="/pricing">Pricing</Link>
          </TabsTrigger>

          <TabsTrigger value="github" asChild>
            <Link
              href="https://github.com/lightfastai/lightfast"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
          </TabsTrigger>

          <TabsTrigger value="updates" asChild>
            <Link href="/updates">Updates</Link>
          </TabsTrigger>

          <TabsTrigger value="signin" asChild>
            <Link href={authUrl}>Sign In</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Button
        asChild
        size="sm"
        className="rounded-sm hover:bg-black hover:text-foreground"
      >
        <Link href="/early-access">Join Early Access</Link>
      </Button>
    </nav>
  );
}
