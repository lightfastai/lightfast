import { Logo } from "@repo/ui-v2/components/brand/logo";
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui-v2/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
      <Card className="w-full overflow-hidden border-border/70 bg-card/90 shadow-2xl shadow-black/10">
        <CardHeader className="gap-8 border-border/70 border-b p-8 sm:p-12">
          <Logo size="sm" />
          <div className="max-w-2xl space-y-4">
            <p className="font-medium text-muted-foreground text-sm uppercase tracking-[0.2em]">
              Local workspace
            </p>
            <CardTitle className="text-4xl tracking-tight sm:text-6xl">
              Build locally with the shared Lightfast UI.
            </CardTitle>
            <CardDescription className="max-w-xl text-base leading-7 sm:text-lg">
              This TanStack Start example is intentionally local-only. It has no
              production deployment, hosted authentication, or implicit backend.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
          <p className="max-w-xl text-muted-foreground text-sm leading-6">
            Configure retained SDK, CLI, MCP, and desktop clients with an
            explicit endpoint when connecting them to a compatible backend.
          </p>
          <Button disabled type="button" variant="outline">
            Local only
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
