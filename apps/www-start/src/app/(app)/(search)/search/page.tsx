import { SearchInterface } from "~/app/(app)/_components/search-interface";
import { SearchNavbar } from "~/app/(app)/_components/search-navbar";

export default function SearchPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <SearchNavbar />

      <div className="flex-1 overflow-y-auto px-4 pt-32">
        <SearchInterface />
      </div>
    </div>
  );
}
