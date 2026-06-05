import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/_authenticated/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Lightfast team workspace shell.",
      },
    ],
  }),
  component: OrganizationHomePage,
});

function OrganizationHomePage() {
  const { slug } = Route.useParams();
  const trpc = useTRPC();
  const {
    data: orgAccess,
    error,
    isPending,
  } = useQuery({
    ...trpc.viewer.organization.getBySlug.queryOptions({ slug }),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  if (isPending) {
    return <OrganizationHomeSkeleton slug={slug} />;
  }

  if (error || !orgAccess) {
    return <OrganizationNotFound slug={slug} />;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-24">
      <section className="w-full max-w-lg space-y-6">
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>
        <div className="space-y-3">
          <p className="font-mono text-muted-foreground text-sm">/{slug}</p>
          <h1 className="font-medium font-pp text-2xl text-foreground">
            {orgAccess.org.name}
          </h1>
          <p className="max-w-md text-muted-foreground text-sm leading-6">
            Team creation now lands in the TanStack app. Workspace pages will
            migrate behind this route next.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/account/teams/new">Create another team</Link>
        </Button>
      </section>
    </main>
  );
}

function OrganizationHomeSkeleton({ slug }: { slug: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-24">
      <section className="w-full max-w-lg space-y-6">
        <Skeleton className="size-11 rounded-sm" />
        <div className="space-y-3">
          <p className="font-mono text-muted-foreground text-sm">/{slug}</p>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-3/4 max-w-md" />
        </div>
      </section>
    </main>
  );
}

function OrganizationNotFound({ slug }: { slug: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 pb-24">
      <section className="w-full max-w-lg space-y-4">
        <p className="font-mono text-muted-foreground text-sm">/{slug}</p>
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Team not found
        </h1>
        <p className="max-w-md text-muted-foreground text-sm leading-6">
          This team does not exist or your account does not have access.
        </p>
        <Button asChild variant="outline">
          <Link to="/account/teams/new">Create team</Link>
        </Button>
      </section>
    </main>
  );
}
