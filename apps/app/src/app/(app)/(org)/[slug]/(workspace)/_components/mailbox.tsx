"use client";

import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { useState } from "react";
import { MailboxEntityList } from "./mailbox-entity-list";
import { MailboxEventList } from "./mailbox-event-list";

type MailboxTab = "entities" | "events";

export function Mailbox() {
  const [activeTab, setActiveTab] = useState<MailboxTab>("entities");

  return (
    <aside className="flex w-80 flex-shrink-0 flex-col border-r">
      {/* Tab switcher */}
      <div className="shrink-0 border-b px-3 py-2">
        <Tabs
          onValueChange={(v) => setActiveTab(v as MailboxTab)}
          value={activeTab}
        >
          <TabsList className="w-full">
            <TabsTrigger className="flex-1" value="entities">
              Entities
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="events">
              Events
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === "entities" ? (
          <MailboxEntityList />
        ) : (
          <MailboxEventList />
        )}
      </div>
    </aside>
  );
}

export function MailboxSkeleton() {
  return (
    <aside className="flex w-80 flex-shrink-0 flex-col border-r">
      <div className="shrink-0 border-b px-3 py-2">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
      <div className="flex-1 space-y-1 p-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton className="h-16 w-full rounded-md" key={i} />
        ))}
      </div>
    </aside>
  );
}
