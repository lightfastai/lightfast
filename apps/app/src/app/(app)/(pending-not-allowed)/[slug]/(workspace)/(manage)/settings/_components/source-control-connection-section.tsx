import type { AppRouterOutputs } from "@api/app";
import { SourceControlConnectionCard } from "../source-control/_components/source-control-connection-card";

type SourceControlConnection = NonNullable<
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"]
>;
type SourceControlRepositories =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"];

interface SourceControlConnectionSectionProps {
  connection: SourceControlConnection | null;
  orgSlug: string;
  repositories: SourceControlRepositories | null;
}

interface LightfastRepositorySectionProps {
  connection: SourceControlConnection | null;
  orgSlug: string;
}

export function SourceControlConnectionSection({
  connection,
  repositories,
  orgSlug,
}: SourceControlConnectionSectionProps) {
  if (!connection) {
    const organizationLogin =
      repositories?.organization?.login ?? "organization account";
    return (
      <section className="rounded-[12px] border border-border bg-background p-4">
        <p className="text-muted-foreground text-sm">
          No GitHub connection configured for {orgSlug} ({organizationLogin}).
        </p>
      </section>
    );
  }

  return (
    <SourceControlConnectionCard connection={connection} orgSlug={orgSlug} />
  );
}

export function LightfastRepositorySection({
  connection,
  orgSlug,
}: LightfastRepositorySectionProps) {
  const displayName = connection?.lightfastRepository?.fullName
    ? connection.lightfastRepository.fullName
    : `${connection?.accountLogin ?? orgSlug}/.lightfast`;

  return (
    <section className="rounded-[12px] border border-border bg-background p-4">
      <p className="font-medium text-foreground text-sm">
        Lightfast Repository
      </p>
      <p className="text-muted-foreground text-sm">{displayName}</p>
    </section>
  );
}
