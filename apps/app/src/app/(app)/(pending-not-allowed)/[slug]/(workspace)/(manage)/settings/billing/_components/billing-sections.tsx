import type { AppRouterOutputs } from "@api/app";
import {
  cardLabel,
  formatMoney,
  statementStatusLabel,
  statusLabel,
} from "@repo/app-billing";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import type {
  BillingMoneyAmount,
  BillingPaymentMethodResource,
  BillingStatementResource,
} from "@vendor/clerk";
import { formatUtcCalendarDate as formatDate } from "@vendor/lib/time";
import { CreditCard } from "lucide-react";
import { memo } from "react";

type BillingSubscription =
  AppRouterOutputs["org"]["settings"]["orgBilling"]["overview"]["subscription"];

export function LoadingLine({ label }: { label: string }) {
  return (
    <div className="h-5 animate-pulse rounded bg-muted/40">
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface PlanSectionProps {
  canceledAt?: Date | number | null;
  currentAmount?: BillingMoneyAmount | null;
  currentPlanName: string;
  currentTier: "starter" | "team" | null;
  isAdmin: boolean;
  nextPayment: BillingSubscription["nextPayment"] | null;
  onAdjustPlan: () => void;
  periodEnd?: Date | number | null;
  status: BillingSubscription["status"] | "active";
}

export const PlanSection = memo(function PlanSection({
  canceledAt,
  currentAmount,
  currentPlanName,
  currentTier,
  isAdmin,
  nextPayment,
  onAdjustPlan,
  periodEnd,
  status,
}: PlanSectionProps) {
  const nextPaymentDate = formatDate(nextPayment?.date);
  const periodEndDate = formatDate(periodEnd);
  const renewalCopy =
    currentTier === "team" && canceledAt && periodEndDate
      ? `Your ${currentPlanName} plan is scheduled to end on ${periodEndDate}.`
      : currentTier === "team" && nextPaymentDate
        ? `Your subscription will auto renew on ${nextPaymentDate}.`
        : "Your organization is on the free Starter plan.";

  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{currentPlanName}</p>
          <Badge className="capitalize" variant="secondary">
            {statusLabel(status)}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          {currentAmount ? `${formatMoney(currentAmount)}/month` : "Free"}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">{renewalCopy}</p>
      </div>
      {isAdmin && (
        <Button onClick={onAdjustPlan} size="sm" variant="secondary">
          Adjust plan
        </Button>
      )}
    </section>
  );
});

interface PaymentSectionProps {
  defaultPaymentMethod: BillingPaymentMethodResource | null;
  isAdmin: boolean;
  isLoading: boolean;
  onUpdate: () => void;
}

export const PaymentSection = memo(function PaymentSection({
  defaultPaymentMethod,
  isAdmin,
  isLoading,
  onUpdate,
}: PaymentSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <h3 className="font-semibold text-foreground text-lg">Payment</h3>
        <div className="mt-5 flex items-center gap-3 text-sm">
          <CreditCard className="size-4 text-muted-foreground" />
          {isLoading ? (
            <span className="text-muted-foreground">
              Loading payment method
            </span>
          ) : (
            <span>{cardLabel(defaultPaymentMethod)}</span>
          )}
        </div>
      </div>
      {isAdmin && (
        <Button onClick={onUpdate} size="sm" variant="secondary">
          Update
        </Button>
      )}
    </section>
  );
});

interface InvoicesSectionProps {
  isLoading: boolean;
  onViewStatement: (statement: BillingStatementResource) => void;
  statements: BillingStatementResource[];
}

export const InvoicesSection = memo(function InvoicesSection({
  isLoading,
  onViewStatement,
  statements,
}: InvoicesSectionProps) {
  return (
    <section>
      <h3 className="font-semibold text-foreground text-lg">Invoices</h3>
      {isLoading ? (
        <LoadingLine label="Loading invoices" />
      ) : statements.length === 0 ? (
        <p className="mt-5 text-muted-foreground text-sm">No invoices yet.</p>
      ) : (
        <Table className="mt-5">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-0">Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statements.slice(0, 5).map((statement) => (
              <TableRow
                className="border-0 hover:bg-transparent"
                key={statement.id}
              >
                <TableCell className="px-0">
                  {formatDate(statement.timestamp) ?? "Invoice"}
                </TableCell>
                <TableCell>
                  {formatMoney(statement.totals.grandTotal)}
                </TableCell>
                <TableCell className="capitalize">
                  {statementStatusLabel(statement.status)}
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => onViewStatement(statement)}
                    size="sm"
                    variant="link-blue"
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
});

interface CancellationSectionProps {
  canCancel: boolean;
  canceledAt?: Date | number | null;
  isAdmin: boolean;
  onCancelPlan: () => void;
  periodEnd?: Date | number | null;
}

export const CancellationSection = memo(function CancellationSection({
  canceledAt,
  canCancel,
  isAdmin,
  onCancelPlan,
  periodEnd,
}: CancellationSectionProps) {
  const periodEndDate = formatDate(periodEnd);
  const copy = canceledAt
    ? periodEndDate
      ? `Team plan is scheduled to end on ${periodEndDate}.`
      : "Team plan cancellation is scheduled."
    : canCancel && isAdmin
      ? "Cancel plan"
      : canCancel
        ? "Team cancellation is managed by organization admins."
        : "No paid plan is active for this organization.";

  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <h3 className="font-semibold text-foreground text-lg">Cancellation</h3>
        <p className="mt-5 text-sm">{copy}</p>
      </div>
      {isAdmin && canCancel && !canceledAt && (
        <Button onClick={onCancelPlan} size="sm" variant="destructive">
          Cancel plan
        </Button>
      )}
    </section>
  );
});
