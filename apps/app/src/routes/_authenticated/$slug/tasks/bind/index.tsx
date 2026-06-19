import { getOrganizationBySlug } from "@api/app/tanstack/organizations";
import { githubBindErrorCodeSchema } from "@lightfast/connector-github/contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useSearch } from "@tanstack/react-router";
import { BindGithubCard } from "~/org/setup/bind-github-card";
import {
  ORGANIZATION_STALE_TIME,
  organizationQueryKeys,
} from "~/organization/organization-cache";

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
  return <BindTaskPageContent />;
}

function BindTaskPageContent() {
  const { slug } = Route.useParams();
  const search = useSearch({ strict: false });
  const parsedError = githubBindErrorCodeSchema.safeParse(search.github_error);
  const githubError = parsedError.success ? parsedError.data : undefined;
  const { data: gate, isPending } = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => getOrganizationBySlug({ data: { slug } }),
    queryKey: organizationQueryKeys.bySlug(slug),
    staleTime: ORGANIZATION_STALE_TIME,
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
