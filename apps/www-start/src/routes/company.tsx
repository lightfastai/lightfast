import { createFileRoute } from "@tanstack/react-router";
import ManifestoLayout from "~/app/(app)/(company)/company/layout";
import ManifestoPage, {
  getLatestCommit,
} from "~/app/(app)/(company)/company/page";
import CompanyGroupLayout from "~/app/(app)/(company)/layout";

export const Route = createFileRoute("/company")({
  head: () => ({
    meta: [
      {
        title: "Lightfast Company",
      },
    ],
  }),
  loader: () => getLatestCommit(),
  component: CompanyRoute,
});

function CompanyRoute() {
  const latestCommit = Route.useLoaderData();

  return (
    <CompanyGroupLayout>
      <ManifestoLayout>
        <ManifestoPage latestCommit={latestCommit} />
      </ManifestoLayout>
    </CompanyGroupLayout>
  );
}
