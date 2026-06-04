import { createFileRoute } from "@tanstack/react-router";
import SearchLayout from "~/app/(app)/(search)/layout";
import SearchPage from "~/app/(app)/(search)/search/page";
import { buildSearchHead } from "~/lib/search-content";

export const Route = createFileRoute("/search")({
  head: () => buildSearchHead(),
  component: SearchRoute,
});

function SearchRoute() {
  return (
    <SearchLayout>
      <SearchPage />
    </SearchLayout>
  );
}
