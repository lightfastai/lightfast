import { createFileRoute } from "@tanstack/react-router";
import CompanyGroupLayout from "~/app/(app)/(company)/layout";
import CareersPage, {
  getCareersContent,
} from "~/app/(app)/(company)/careers/page";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      {
        title: "Careers",
      },
      {
        name: "description",
        content: "Open positions at Lightfast.",
      },
    ],
  }),
  loader: () => getCareersContent(),
  component: CareersRoute,
});

function CareersRoute() {
  const content = Route.useLoaderData();

  return (
    <CompanyGroupLayout>
      <CareersPage content={content} />
    </CompanyGroupLayout>
  );
}
