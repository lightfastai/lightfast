import { formatMoney, statementStatusLabel } from "@repo/app-billing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import type { BillingStatementResource } from "@vendor/clerk/client/experimental";
import { formatUtcCalendarDate as formatDate } from "@vendor/lib/time";

export function StatementDetailsDialog({
  onOpenChange,
  statement,
}: {
  onOpenChange: (open: boolean) => void;
  statement: BillingStatementResource | null;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={!!statement}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invoice details</DialogTitle>
          <DialogDescription>
            {statement ? formatDate(statement.timestamp) : null}
          </DialogDescription>
        </DialogHeader>
        {statement && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="font-medium">
                  {formatMoney(statement.totals.grandTotal)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="text-muted-foreground text-sm">Status</span>
                <span className="capitalize">
                  {statementStatusLabel(statement.status)}
                </span>
              </div>
            </div>
            {statement.groups.some((group) => group.items.length > 0) ? (
              <div className="space-y-2">
                {statement.groups.flatMap((group) =>
                  group.items.map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={item.id}
                    >
                      <span>{item.subscriptionItem.plan.name}</span>
                      <span>{formatMoney(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No line-item detail is available for this invoice.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
