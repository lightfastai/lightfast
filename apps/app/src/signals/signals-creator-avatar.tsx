import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import {
  Key01Icon as KeyRound,
  UserIcon as User,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTRPC } from "~/trpc/react";
import type { SignalListItem } from "./signals-model";

function deriveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts.at(-1)![0]!).toUpperCase();
}

/**
 * Avatar (size-5 / 20px) of whoever created the signal.
 *
 * Resolves `createdByUserId` against the org member list (one shared,
 * cached query). Falls back gracefully:
 * - API-key signals -> key glyph,
 * - unresolved user (still loading / not a current member) -> neutral user glyph.
 */
export function SignalCreatorAvatar({
  signal,
}: {
  signal: Pick<SignalListItem, "createdByApiKeyId" | "createdByUserId">;
}) {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.org.settings.orgMembers.list.queryOptions(),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  if (signal.createdByApiKeyId) {
    return (
      <Avatar className="size-5" title="Created by API key">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <HugeiconsIcon icon={KeyRound} className="size-2.5" />
        </AvatarFallback>
      </Avatar>
    );
  }

  const member = data?.members.find(
    (candidate) => candidate.userId === signal.createdByUserId
  );

  if (!member) {
    return (
      <Avatar className="size-5" title="Unknown member">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <HugeiconsIcon icon={User} className="size-2.5" />
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar className="size-5" title={member.name}>
      <AvatarImage alt={member.name} src={member.imageUrl} />
      <AvatarFallback className="bg-foreground text-[9px] text-background">
        {deriveInitials(member.name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}
