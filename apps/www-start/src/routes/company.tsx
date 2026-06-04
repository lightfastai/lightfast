import { createFileRoute } from "@tanstack/react-router";
import CompanyGroupLayout from "~/app/(app)/(company)/layout";
import ManifestoLayout from "~/app/(app)/(company)/company/layout";
import ManifestoPage, {
  getLatestCommit,
} from "~/app/(app)/(company)/company/page";

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
