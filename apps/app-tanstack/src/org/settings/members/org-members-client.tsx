import { Input } from "@repo/ui/components/ui/input";
import { Search } from "lucide-react";
import { useCallback, useDeferredValue, useState } from "react";
import { OrgMemberInvite } from "./org-member-invite";
import { OrgMemberList } from "./org-member-list";

export function OrgMembersClient() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value);
    },
    []
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-base text-foreground">
          Team members
        </h3>
        <OrgMemberInvite />
      </div>

      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search members"
          className="pl-8"
          onChange={handleSearchChange}
          placeholder="Search members"
          size="lf"
          value={search}
          variant="lf"
        />
      </div>

      <OrgMemberList searchQuery={deferredSearch} />
    </section>
  );
}
