import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import type { DeveloperConnectionCatalogRow } from "./developer-connections-model";
import {
  developerConnectionStatus,
  displayDeveloperConnectionProvider,
} from "./developer-connections-model";

export function DeveloperConnectionDetailSheet({
  onOpenChange,
  row,
}: {
  onOpenChange: (open: boolean) => void;
  row?: DeveloperConnectionCatalogRow;
}) {
  if (!row?.connection) {
    return null;
  }

  const status = developerConnectionStatus(row);

  return (
    <Sheet onOpenChange={onOpenChange} open>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{row.displayName}</SheetTitle>
          <SheetDescription>
            {displayDeveloperConnectionProvider(row.provider)} sandbox
            credential status.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="mt-1 text-foreground">{status.label}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Connected account</p>
            <p className="mt-1 text-foreground">
              {row.connection.providerAccountName}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Materializes</p>
            <p className="mt-1 text-foreground">Temporary env/config only</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
