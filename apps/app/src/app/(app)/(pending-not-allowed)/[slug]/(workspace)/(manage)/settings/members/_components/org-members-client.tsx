"use client";

import { Input } from "@repo/ui/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { OrgMemberInvite } from "./org-member-invite";
import { OrgMemberList } from "./org-member-list";

export function OrgMembersClient() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search members"
            className="pl-8"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            value={search}
          />
        </div>
        <OrgMemberInvite />
      </div>

      <OrgMemberList searchQuery={search} />
    </div>
  );
}
