import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import DocsShell from "~/app/(app)/(content)/docs/docs-shell";
import DeveloperPlatformLanding from "~/app/(app)/(content)/docs/(general)/[[...slug]]/_components/developer-platform-landing";
import {
  buildDocsHead,
  buildDocsRootHead,
  buildDocsJsonLd,
  getDocsPage,
} from "~/lib/docs-content";

export const Route = createFileRoute("/docs/$")({
  loader: ({ params }) => {
    if (!params._splat) {
      throw redirect({
        href: "/docs/get-started/overview",
        statusCode: 307,
      });
    }

    const page = getDocsPage(params._splat);

    if (!page) {
      throw notFound();
    }

    return page;
  },
  head: ({ params }) => {
    if (!params._splat) {
      return buildDocsRootHead();
    }

    const page = getDocsPage(params._splat);

    return page ? buildDocsHead(page) : {};
  },
  component: DocsRoute,
});

function DocsRoute() {
  const page = Route.useLoaderData();

  return (
    <DocsShell currentPath={page.path}>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is generated from local typed content.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildDocsJsonLd(page)),
        }}
        type="application/ld+json"
      />
      <DeveloperPlatformLanding />
    </DocsShell>
  );
}
