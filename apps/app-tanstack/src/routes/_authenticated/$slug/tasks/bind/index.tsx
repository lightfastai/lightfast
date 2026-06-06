import { githubBindErrorCodeSchema } from "@repo/github-app-contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";
import { BindGithubCard } from "~/org/setup/bind-github-card";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/_authenticated/$slug/tasks/bind/")({
  head: ({ params }) => ({
    meta: [{ title: `Connect GitHub - ${params.slug} - Lightfast` }],
  }),
  validateSearch: (search) => {
    const parsedError = githubBindErrorCodeSchema.safeParse(
      search.github_error
    );
    return {
      github_error: parsedError.success ? parsedError.data : undefined,
    };
  },
  component: BindTaskPage,
});

function BindTaskPage() {
  const { slug } = Route.useParams();
  const search = useSearch({ strict: false });
  const parsedError = githubBindErrorCodeSchema.safeParse(search.github_error);
  const githubError = parsedError.success ? parsedError.data : undefined;
  const trpc = useTRPC();
  const { data: gate, isPending } = useQuery({
    ...trpc.viewer.organization.getBySlug.queryOptions({ slug }),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  if (isPending) {
    return <SetupPageSkeleton label="Loading setup" />;
  }

  if (gate?.bindingStatus === "bound") {
    return (
      <Navigate
        params={{ slug }}
        replace
        to="/$slug/tasks/bind/github/complete"
      />
    );
  }

  if (gate?.nextSetupRequirement === "github_lightfast_repo") {
    return (
      <Navigate
        params={{ slug }}
        replace
        to="/$slug/tasks/github/lightfast-repo"
      />
    );
  }

  return <BindGithubCard githubError={githubError} orgSlug={slug} />;
}

function SetupPageSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="grid min-h-full flex-1 place-items-center px-4 pb-32"
      role="status"
    >
      <div className="h-5 w-40 rounded-md bg-muted" />
    </div>
  );
}
