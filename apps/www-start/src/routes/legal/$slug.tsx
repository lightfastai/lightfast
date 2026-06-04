import { createFileRoute, notFound } from "@tanstack/react-router";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import LegalLayout from "~/app/(app)/(marketing)/legal/layout";
import LegalPageView from "~/app/(app)/(marketing)/legal/page";
import { buildLegalHead, getLegalPage } from "~/lib/legal-content";

export const Route = createFileRoute("/legal/$slug")({
  loader: ({ params }) => {
    const page = getLegalPage(params.slug);

    if (!page) {
      throw notFound();
    }

    return page;
  },
  head: ({ params }) => {
    const page = getLegalPage(params.slug);

    return page ? buildLegalHead(page) : {};
  },
  component: LegalRoute,
});

function LegalRoute() {
  const page = Route.useLoaderData();

  return (
    <MarketingLayout>
      <LegalLayout>
        <LegalPageView page={page} />
      </LegalLayout>
    </MarketingLayout>
  );
}
