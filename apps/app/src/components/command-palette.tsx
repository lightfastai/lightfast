"use client";

import { useActiveOrg } from "@repo/app-trpc/hooks";
import type { SearchResult } from "@repo/app-validation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/ui/command";
import {
  Activity,
  Boxes,
  Briefcase,
  Loader2,
  MessageSquare,
  Plug,
  Settings,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createApiClient } from "~/lib/api-client";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  title: string;
}

function getNavItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Explore",
      href: `/${orgSlug}`,
      icon: MessageSquare,
      keywords: ["chat", "ask", "ai", "answer"],
    },
    {
      title: "Entities",
      href: `/${orgSlug}/entities`,
      icon: Boxes,
      keywords: ["objects", "resources", "infrastructure"],
    },
    {
      title: "Events",
      href: `/${orgSlug}/events`,
      icon: Activity,
      keywords: ["logs", "activity", "webhook"],
    },
    {
      title: "Sources",
      href: `/${orgSlug}/sources`,
      icon: Plug,
      keywords: ["integrations", "connections", "providers"],
    },
    {
      title: "Jobs",
      href: `/${orgSlug}/jobs`,
      icon: Briefcase,
      keywords: ["tasks", "background", "workers"],
    },
    {
      title: "Settings",
      href: `/${orgSlug}/settings`,
      icon: Settings,
      keywords: ["preferences", "config", "api", "keys"],
    },
  ];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const activeOrg = useActiveOrg();

  const orgSlug = activeOrg?.slug ?? "";
  const clerkOrgId = activeOrg?.id ?? "";
  const navItems = getNavItems(orgSlug);

  const client = useMemo(() => createApiClient(clerkOrgId), [clerkOrgId]);

  // Cmd+K global listener (capture phase, same pattern as docs search)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      abortRef.current?.abort();
    }
  }, [open]);

  // Debounced entity search via oRPC client
  useEffect(() => {
    if (query.length < 2 || !clerkOrgId) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setIsLoading(true);

      client
        .search({ query, limit: 10 }, { signal: abortRef.current.signal })
        .then((data) => {
          setResults(data.results);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          setIsLoading(false);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [query, clerkOrgId, client]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href as Route);
    },
    [router]
  );

  // Filter nav items client-side when query is present
  const filteredNav = query
    ? navItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.keywords.some((kw) => kw.includes(query.toLowerCase()))
      )
    : navItems;

  return (
    <CommandDialog
      description="Search entities or navigate to a page"
      onOpenChange={setOpen}
      open={open}
      shouldFilter={false}
      title="Command Palette"
    >
      <CommandInput
        onValueChange={setQuery}
        placeholder="Search entities or jump to..."
        value={query}
      />
      <CommandList className="max-h-[min(400px,50vh)]">
        <CommandEmpty>No results found.</CommandEmpty>

        {filteredNav.length > 0 && (
          <CommandGroup heading="Navigation">
            {filteredNav.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => handleSelect(item.href)}
              >
                <item.icon className="mr-2 size-4" />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {query.length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Entities">
              {isLoading && results.length === 0 && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {results.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() =>
                    handleSelect(`/${orgSlug}/entities/${result.id}`)
                  }
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{result.title}</span>
                    {result.snippet && (
                      <span className="line-clamp-1 text-muted-foreground text-xs">
                        {result.snippet}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
