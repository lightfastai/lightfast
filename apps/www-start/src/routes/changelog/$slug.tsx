import { createFileRoute, notFound } from "@tanstack/react-router";
import ChangelogEntryPage from "~/app/(app)/(marketing)/(content)/changelog/[slug]/page";
import ChangelogLayout from "~/app/(app)/(marketing)/(content)/changelog/layout";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import {
  buildChangelogEntryHead,
  getChangelogPage,
} from "~/lib/changelog-content";

export const Route = createFileRoute("/changelog/$slug")({
  loader: ({ params }) => {
    const page = getChangelogPage(params.slug);

    if (!page) {
      throw notFound();
    }

    return page;
  },
  head: ({ params }) => {
    const page = getChangelogPage(params.slug);

    return page ? buildChangelogEntryHead(page) : {};
  },
  component: ChangelogEntryRoute,
});

function ChangelogEntryRoute() {
  const page = Route.useLoaderData();

  return (
    <MarketingLayout>
      <ChangelogLayout>
        <ChangelogEntryPage page={page} />
      </ChangelogLayout>
    </MarketingLayout>
  );
}
