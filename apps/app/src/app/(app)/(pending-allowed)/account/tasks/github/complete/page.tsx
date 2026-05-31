import { GithubAccountCompleteClient } from "./_components/github-account-complete-client";

export const dynamic = "force-dynamic";

interface GitHubAccountCompletePageProps {
  searchParams: Promise<{ return_to?: string | string[] }>;
}

export default async function GitHubAccountCompletePage({
  searchParams,
}: GitHubAccountCompletePageProps) {
  const { return_to: returnToParam } = await searchParams;

  return (
    <GithubAccountCompleteClient
      returnTo={Array.isArray(returnToParam) ? returnToParam[0] : returnToParam}
    />
  );
}
