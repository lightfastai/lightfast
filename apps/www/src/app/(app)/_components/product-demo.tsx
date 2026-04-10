import { Icons } from "@repo/ui/components/icons";
import {
  Activity,
  ArrowUp,
  Briefcase,
  ChevronsUpDown,
  MessageSquare,
  Plug,
  Search,
  Settings,
} from "lucide-react";
import { ProductDemoMailbox } from "./product-demo-mailbox";

export function ProductDemo() {
  return (
    <div className="dark overflow-hidden rounded-lg">
      <div className="flex h-[540px] bg-background border overflow-hidden rounded-lg border-border/50 md:h-[580px] lg:h-[620px]">
        {/* Sidebar — hidden below lg */}
        <Sidebar />
        {/* Right column */}
        <div className="flex min-h-0 flex-1 flex-col pr-1.5 pb-1.5 md:pr-2 md:pb-2">
          {/* Inset card */}
          <div className="mt-1.5 flex flex-1 overflow-hidden rounded-lg border border-border/50 bg-background md:mt-2">
            <ProductDemoMailbox />
            <Chat />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */

const sidebarPrimaryNav = [
  { label: "Explore", icon: MessageSquare, active: true },
];

const sidebarManageNav = [
  { label: "Events", icon: Activity },
  { label: "Sources", icon: Plug },
  { label: "Jobs", icon: Briefcase },
  { label: "Settings", icon: Settings },
];

function Sidebar() {
  return (
    <div className="hidden w-[14rem] shrink-0 flex-col lg:flex">
      {/* Header */}
      <div className="flex h-14 items-center gap-2 px-4">
        <Icons.logoShort className="size-3" />
        <span className="font-medium text-base font-pp">Lightfast</span>
        <button
          className="ml-auto flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          type="button"
        >
          <ChevronsUpDown className="size-3.5" />
        </button>
        <button
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          type="button"
        >
          <Search className="size-3.5" />
        </button>
      </div>

      {/* Primary nav */}
      <div className="flex flex-col gap-0.5 px-2">
        {sidebarPrimaryNav.map((item) => (
          <div
            className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted/50 hover:text-foreground ${
              item.active
                ? "bg-muted/50 font-medium text-foreground"
                : "text-muted-foreground"
            }`}
            key={item.label}
          >
            <item.icon className="size-3.5" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Manage group */}
      <div className="mt-4 flex flex-col gap-0.5">
        <span className="px-4 text-muted-foreground text-xs">Manage</span>
        <div className="flex flex-col gap-0.5 px-2">
          {sidebarManageNav.map((item) => (
            <div
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted/50 hover:text-foreground"
              key={item.label}
            >
              <item.icon className="size-3.5" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat (empty state)                                                */
/* ------------------------------------------------------------------ */

function Chat() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background">
      <div className="-mt-8 w-full max-w-3xl px-1.5 md:px-3 lg:px-6 xl:px-10">
        <p className="text-center font-semibold text-2xl">
          Explore your infrastructure
        </p>
        {/* Prompt input replica */}
        <div className="mt-4 w-full overflow-hidden rounded-xl border border-border/50 bg-card/40 shadow-sm backdrop-blur-md">
          <div className="flex flex-col">
            <div className="min-h-[32px] p-3 text-muted-foreground text-sm leading-6">
              Ask anything about your organization...
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-2">
            <div className="flex size-8 items-center justify-center rounded-full border border-border/50 shadow-sm">
              <ArrowUp className="size-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
