import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";

export function SiteHeader() {
  return (
    <div className="flex h-14 items-center border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
    </div>
  );
}
