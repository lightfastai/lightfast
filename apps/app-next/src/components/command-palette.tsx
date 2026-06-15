"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@repo/ui/components/ui/command";
import {
  CalendarClock,
  MessageCircle,
  Plus,
  Settings,
  Signal,
  UsersRound,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useActiveOrg } from "~/hooks/use-active-org";

interface CommandPaletteProps {
  onCreateSignal: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const GO_TO = [
  { icon: MessageCircle, label: "Chat", section: "chat" },
  { icon: Signal, label: "Signals", section: "signals" },
  { icon: UsersRound, label: "People", section: "people" },
  { icon: CalendarClock, label: "Automations", section: "automations" },
  { icon: Settings, label: "Settings", section: "settings" },
] as const;

export function CommandPalette({
  onCreateSignal,
  onOpenChange,
  open,
}: CommandPaletteProps) {
  const router = useRouter();
  const org = useActiveOrg();
  const slug = org?.slug;

  function goTo(section: string | null) {
    if (!slug) {
      return;
    }
    onOpenChange(false);
    router.push((section ? `/${slug}/${section}` : `/${slug}`) as Route);
  }

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Create">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onCreateSignal();
            }}
          >
            <Plus />
            Create signal
            <CommandShortcut>C</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          {GO_TO.map(({ icon: Icon, label, section }) => (
            <CommandItem key={section} onSelect={() => goTo(section)}>
              <Icon />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-4 border-border/50 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span className="ml-auto">esc close</span>
      </div>
    </CommandDialog>
  );
}
