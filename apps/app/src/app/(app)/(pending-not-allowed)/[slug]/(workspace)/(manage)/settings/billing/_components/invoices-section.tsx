import type { BillingStatementResource } from "@vendor/clerk/client/experimental";
import { Button } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

import {
  formatDate,
  formatMoney,
  statementStatusLabel,
} from "./billing-utils";
import { LoadingLine } from "./loading-line";

export function InvoicesSection({
  isLoading,
  onViewStatement,
  statements,
}: {
  isLoading: boolean;
  onViewStatement: (statement: BillingStatementResource) => void;
  statements: BillingStatementResource[];
}) {
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
}
