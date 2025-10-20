"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
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

      <Button variant="ghost" size="icon" className="text-white" asChild>
        <Link
          href="https://github.com/lightfastai/lightfast"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icons.gitHub className="h-5 w-5" />
          <span className="sr-only">GitHub</span>
        </Link>
      </Button>
    </nav>
  );
}
