import { GitHubBindCompleteClient } from "./_components/github-bind-complete-client";

interface GitHubBindCompletePageProps {
  params: Promise<{ slug: string }>;
}

export default async function GitHubBindCompletePage({
  params,
}: GitHubBindCompletePageProps) {
  const { slug } = await params;

  return <GitHubBindCompleteClient orgSlug={slug} />;
}
