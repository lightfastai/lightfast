"use client";

import type { AppRouterOutputs } from "@api/app";
import { useTRPC } from "@repo/app-trpc/react";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useAuth, useOrganization } from "@vendor/clerk/client";
import {
  CheckoutProvider,
  PaymentElement,
  PaymentElementProvider,
  useCheckout,
  usePaymentElement,
  usePaymentMethods,
  useStatements,
} from "@vendor/clerk/client/experimental";
import {
  AlertCircle,
  Building2,
  Check,
  CreditCard,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";

type BillingOverview =
  AppRouterOutputs["pendingNotAllowed"]["orgBilling"]["overview"];
type BillingPlan = BillingOverview["plans"][number];
type BillingSubscriptionItem =
  BillingOverview["subscription"]["subscriptionItems"][number];
type BillingMoney = NonNullable<BillingPlan["amount"]>;
type PlanTier = BillingPlan["tier"] | "business";

interface BillingPaymentMethod {
  cardType?: string | null;
  id: string;
  isDefault?: boolean;
  isRemovable?: boolean;
  last4?: string | null;
  makeDefault?: (params?: { orgId?: string }) => Promise<unknown>;
  remove?: (params?: { orgId?: string }) => Promise<unknown>;
  status: string;
}

interface BillingStatement {
  groups?: Array<{
    items?: Array<{
      amount?: BillingMoney | null;
      description?: string | null;
      id?: string;
      status?: string;
    }>;
    timestamp?: Date | number;
  }>;
  id: string;
  status: string;
  timestamp: Date | number;
  totals: {
    grandTotal: BillingMoney | null;
    subtotal?: BillingMoney | null;
    taxTotal?: BillingMoney | null;
  };
}

interface PendingPlanChange {
  amountLabel: string;
  description: string;
  plan?: BillingPlan;
  tier: PlanTier;
  title: string;
}

function formatMoney(amount?: BillingMoney | null) {
  if (!amount) {
    return "Free";
  }
  return `${amount.currencySymbol}${amount.amountFormatted}`;
}

function formatDate(value?: Date | number | null) {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statementStatusLabel(status: string) {
  return status === "closed" ? "Paid" : statusLabel(status);
}

function planAmountLabel(plan: BillingPlan) {
  if (!plan.amount) {
    return "Free";
  }
  return `${formatMoney(plan.amount)}/month`;
}

function cardLabel(method?: BillingPaymentMethod | null) {
  if (!method) {
    return "No payment method";
  }
  const cardType = method.cardType
    ? `${method.cardType.charAt(0).toUpperCase()}${method.cardType.slice(1)}`
    : "Card";
  return `${cardType} •••• ${method.last4 ?? "----"}`;
}

function checkoutErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const billingError = error as {
      code?: string | null;
      error?: { code?: string | null; message?: string | null };
      longMessage?: string | null;
      message?: string | null;
    };
    return (
      billingError.longMessage ??
      billingError.message ??
      billingError.error?.message ??
      billingError.error?.code ??
      billingError.code ??
      "Checkout failed"
    );
  }
  return "Checkout failed";
}

function paymentErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const paymentError = error as {
      code?: string | null;
      error?: { code?: string | null; message?: string | null };
      message?: string | null;
    };
    return (
      paymentError.message ??
      paymentError.error?.message ??
      paymentError.error?.code ??
      paymentError.code ??
      "Payment method could not be updated"
    );
  }
  return "Payment method could not be updated";
}

export function BillingSettingsClient() {
  const { has, isLoaded, orgId } = useAuth();
  const { organization } = useOrganization();
  const isAdmin = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const overviewQueryOptions =
    trpc.pendingNotAllowed.orgBilling.overview.queryOptions();
  const { data } = useSuspenseQuery({
    ...overviewQueryOptions,
    staleTime: 5 * 60 * 1000,
  });
  const paymentMethodsQuery = usePaymentMethods({
    for: "organization",
    pageSize: 20,
  });
  const statementsQuery = useStatements({
    for: "organization",
    pageSize: 10,
  });

  const paymentMethods = (paymentMethodsQuery.data ??
    []) as BillingPaymentMethod[];
  const statements = (statementsQuery.data ?? []) as BillingStatement[];
  const defaultPaymentMethod =
    paymentMethods.find((method) => method.isDefault) ??
    paymentMethods[0] ??
    null;

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlan | null>(null);
  const [pendingPlanChange, setPendingPlanChange] =
    useState<PendingPlanChange | null>(null);
  const [cancelItem, setCancelItem] = useState<BillingSubscriptionItem | null>(
    null
  );
  const [selectedStatement, setSelectedStatement] =
    useState<BillingStatement | null>(null);

  const invalidateOverview = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: overviewQueryOptions.queryKey,
      }),
    [queryClient, overviewQueryOptions.queryKey]
  );

  const revalidatePaymentMethods = useCallback(() => {
    const revalidate = (
      paymentMethodsQuery as { revalidate?: () => Promise<void> | void }
    ).revalidate;
    if (typeof revalidate === "function") {
      return revalidate();
    }
  }, [paymentMethodsQuery]);

  const cancelMutation = useMutation(
    trpc.pendingNotAllowed.orgBilling.cancelSubscriptionItem.mutationOptions({
      meta: { errorTitle: "Failed to schedule cancellation" },
      onSettled: () => void invalidateOverview(),
    })
  );

  const currentItem = data.subscription.currentItem;
  const currentPlan = currentItem?.plan;
  const currentTier = currentPlan?.tier ?? "starter";
  const currentPlanName = currentPlan?.name ?? "Starter";
  const currentAmount = currentItem?.amount ?? currentPlan?.amount ?? null;
  const nextPayment =
    data.subscription.nextPayment ?? currentItem?.nextPayment ?? null;
  const teamPlan = data.plans.find((plan) => plan.tier === "team") ?? null;
  const starterPlan =
    data.plans.find((plan) => plan.tier === "starter") ?? null;
  const cancelableTeamItem =
    currentItem?.plan?.tier === "team" && !currentItem.canceledAt
      ? currentItem
      : null;

  function confirmPlanChange(change: PendingPlanChange) {
    if (change.tier === "starter") {
      if (!cancelableTeamItem) {
        setPendingPlanChange(null);
        return;
      }
      cancelMutation.mutate({
        subscriptionItemId: cancelableTeamItem.id,
      });
      setPendingPlanChange(null);
      setIsPlanDialogOpen(false);
      return;
    }

    if (change.tier === "team" && change.plan) {
      setCheckoutPlan(change.plan);
      setPendingPlanChange(null);
      setIsPlanDialogOpen(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Billing
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage plan, payment method, invoices, and cancellation for this
          organization.
        </p>
      </div>

      <div className="space-y-10">
        <PlanSection
          currentAmount={currentAmount}
          currentPlanName={currentPlanName}
          currentTier={currentTier}
          isAdmin={isAdmin}
          nextPayment={nextPayment}
          onAdjustPlan={() => setIsPlanDialogOpen(true)}
          status={data.subscription.status}
        />

        <PaymentSection
          defaultPaymentMethod={defaultPaymentMethod}
          isAdmin={isAdmin}
          isLoading={paymentMethodsQuery.isLoading}
          onUpdate={() => setIsPaymentDialogOpen(true)}
        />

        <InvoicesSection
          isLoading={statementsQuery.isLoading}
          onViewStatement={setSelectedStatement}
          statements={statements}
        />

        <CancellationSection
          canCancel={!!cancelableTeamItem}
          isAdmin={isAdmin}
          onCancelPlan={() => setCancelItem(cancelableTeamItem)}
        />
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-border/60 px-4 py-4">
          <p className="font-medium text-sm">
            Billing is managed by organization admins.
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            Ask an organization admin to make subscription or payment changes.
          </p>
        </div>
      )}

      <PlanSelectionDialog
        businessContact={data.businessContact}
        currentTier={currentTier}
        isConfirming={!!pendingPlanChange}
        onOpenChange={setIsPlanDialogOpen}
        onSelectPlan={setPendingPlanChange}
        open={isPlanDialogOpen}
        starterPlan={starterPlan}
        teamPlan={teamPlan}
      />

      <ConfirmPlanChangeDialog
        change={pendingPlanChange}
        currentItem={currentItem}
        currentPlanName={currentPlanName}
        onConfirm={confirmPlanChange}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPlanChange(null);
          }
        }}
      />

      <PaymentMethodDialog
        defaultPaymentMethod={defaultPaymentMethod}
        isLoading={paymentMethodsQuery.isLoading}
        methods={paymentMethods}
        onOpenChange={setIsPaymentDialogOpen}
        onUpdated={() => void revalidatePaymentMethods()}
        open={isPaymentDialogOpen}
        organization={organization as BillingOrganization | null | undefined}
        orgId={orgId ?? undefined}
      />

      {checkoutPlan && (
        <BillingCheckoutDialog
          onComplete={() => {
            setCheckoutPlan(null);
            void invalidateOverview();
          }}
          onOpenChange={(open) => {
            if (!open) {
              setCheckoutPlan(null);
            }
          }}
          open={!!checkoutPlan}
          plan={checkoutPlan}
        />
      )}

      <StatementDetailsDialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStatement(null);
          }
        }}
        statement={selectedStatement}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setCancelItem(null);
          }
        }}
        open={!!cancelItem}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule Cancellation</AlertDialogTitle>
            <AlertDialogDescription>
              The Team plan will remain active until the end of the current
              billing period. Your organization will return to Starter after
              that period ends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Team</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (!cancelItem) {
                  return;
                }
                cancelMutation.mutate({
                  subscriptionItemId: cancelItem.id,
                });
                setCancelItem(null);
              }}
            >
              Schedule Cancellation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlanSection({
  currentAmount,
  currentPlanName,
  currentTier,
  isAdmin,
  nextPayment,
  onAdjustPlan,
  status,
}: {
  currentAmount: BillingMoney | null;
  currentPlanName: string;
  currentTier: BillingPlan["tier"];
  isAdmin: boolean;
  nextPayment: { amount: BillingMoney | null; date: number } | null;
  onAdjustPlan: () => void;
  status: string;
}) {
  const nextPaymentDate = formatDate(nextPayment?.date);
  const renewalCopy =
    currentTier === "team" && nextPaymentDate
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
}

function PaymentSection({
  defaultPaymentMethod,
  isAdmin,
  isLoading,
  onUpdate,
}: {
  defaultPaymentMethod: BillingPaymentMethod | null;
  isAdmin: boolean;
  isLoading: boolean;
  onUpdate: () => void;
}) {
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
}

function InvoicesSection({
  isLoading,
  onViewStatement,
  statements,
}: {
  isLoading: boolean;
  onViewStatement: (statement: BillingStatement) => void;
  statements: BillingStatement[];
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

function CancellationSection({
  canCancel,
  isAdmin,
  onCancelPlan,
}: {
  canCancel: boolean;
  isAdmin: boolean;
  onCancelPlan: () => void;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div>
        <h3 className="font-semibold text-foreground text-lg">Cancellation</h3>
        <p className="mt-5 text-sm">
          {canCancel && isAdmin
            ? "Cancel plan"
            : canCancel
              ? "Team cancellation is managed by organization admins."
              : "No paid plan is active for this organization."}
        </p>
      </div>
      {isAdmin && canCancel && (
        <Button onClick={onCancelPlan} size="sm" variant="destructive">
          Cancel plan
        </Button>
      )}
    </section>
  );
}

function PlanSelectionDialog({
  businessContact,
  currentTier,
  isConfirming,
  onOpenChange,
  onSelectPlan,
  open,
  starterPlan,
  teamPlan,
}: {
  businessContact: BillingOverview["businessContact"];
  currentTier: BillingPlan["tier"];
  isConfirming: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan: (change: PendingPlanChange) => void;
  open: boolean;
  starterPlan: BillingPlan | null;
  teamPlan: BillingPlan | null;
}) {
  const starterAmount = starterPlan ? planAmountLabel(starterPlan) : "Free";
  const teamAmount = teamPlan ? planAmountLabel(teamPlan) : "$60.00/month";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="fixed inset-0 top-0 left-0 z-50 h-dvh max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-6 shadow-none sm:max-w-none md:p-10"
        showCloseButton={false}
      >
        <div
          className={cn("mx-auto w-full max-w-7xl", isConfirming && "blur-sm")}
        >
          <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col">
            <DialogHeader className="items-center gap-6 text-center">
              <DialogTitle className="font-medium text-3xl">
                Choose your plan
              </DialogTitle>
              <DialogDescription className="sr-only">
                Compare organization plans and choose a billing plan.
              </DialogDescription>
            </DialogHeader>
            <DialogClose asChild>
              <Button
                aria-label="Close plan chooser"
                className="absolute top-0 right-0 size-11 rounded-xl"
                size="icon"
                variant="outline"
              >
                <X className="size-5" />
              </Button>
            </DialogClose>

            <div className="mt-10 grid flex-1 gap-6 lg:grid-cols-3">
              <PlanChoiceCard
                amountLabel={starterAmount}
                buttonLabel={
                  currentTier === "starter"
                    ? "Your current plan"
                    : "Switch to Starter"
                }
                description="A free organization workspace for getting started."
                features={[
                  "3 seats included",
                  "Free organization workspace",
                  "Basic access",
                ]}
                icon={<Sparkles className="size-5" />}
                isCurrent={currentTier === "starter"}
                onSelect={() =>
                  onSelectPlan({
                    amountLabel: starterAmount,
                    description:
                      "Billing will switch to Starter at the end of your current Team period.",
                    plan: starterPlan ?? undefined,
                    tier: "starter",
                    title: "Starter",
                  })
                }
                title="Starter"
              />
              <PlanChoiceCard
                amountLabel={teamAmount}
                buttonLabel={
                  currentTier === "team"
                    ? "Your current plan"
                    : "Switch to Team"
                }
                description="More usage and collaboration for active teams."
                features={[
                  "3 seats included",
                  "Priority product limits",
                  "Email support",
                  "Team workspace billing",
                ]}
                icon={<CreditCard className="size-5" />}
                isCurrent={currentTier === "team"}
                onSelect={() => {
                  if (!teamPlan) {
                    return;
                  }
                  onSelectPlan({
                    amountLabel: teamAmount,
                    description:
                      "Billing will start after checkout is complete.",
                    plan: teamPlan,
                    tier: "team",
                    title: "Team",
                  });
                }}
                title="Team"
              />
              <PlanChoiceCard
                amountLabel="Custom"
                buttonLabel={businessContact.label}
                description="Sales-led onboarding for larger teams."
                features={[
                  "SSO/SAML",
                  "Priority API access",
                  "Dedicated support",
                ]}
                icon={<Building2 className="size-5" />}
                isCurrent={false}
                onSelect={() =>
                  onSelectPlan({
                    amountLabel: "Contact sales",
                    description:
                      "We will open an email to continue the Business plan conversation.",
                    tier: "business",
                    title: "Business",
                  })
                }
                title="Business"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanChoiceCard({
  amountLabel,
  buttonLabel,
  description,
  features,
  icon,
  isCurrent,
  onSelect,
  title,
}: {
  amountLabel: string;
  buttonLabel: string;
  description: string;
  features: string[];
  icon: ReactNode;
  isCurrent: boolean;
  onSelect: () => void;
  title: string;
}) {
  return (
    <div className="flex min-h-[520px] flex-col rounded-xl border bg-card px-7 py-8 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold text-2xl">{title}</h3>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-14 font-semibold text-5xl">{amountLabel}</p>
      <p className="mt-6 font-medium text-lg">{description}</p>
      <Button
        className="mt-8 w-full rounded-full"
        disabled={isCurrent}
        onClick={onSelect}
        variant={isCurrent ? "secondary" : "default"}
      >
        {buttonLabel}
      </Button>
      <div className="mt-8 space-y-5 text-muted-foreground text-sm">
        {features.map((feature) => (
          <div className="flex items-center gap-3" key={feature}>
            <Check className="size-4" />
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmPlanChangeDialog({
  change,
  currentItem,
  currentPlanName,
  onConfirm,
  onOpenChange,
}: {
  change: PendingPlanChange | null;
  currentItem: BillingSubscriptionItem | null;
  currentPlanName: string;
  onConfirm: (change: PendingPlanChange) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const changeDate =
    change?.tier === "starter"
      ? formatDate(currentItem?.periodEnd ?? currentItem?.nextPayment?.date)
      : null;
  const body =
    change?.tier === "starter" && changeDate
      ? `Your current ${currentPlanName} subscription will remain active until ${changeDate}, when it will change to Starter.`
      : change?.tier === "team"
        ? "Your organization will move to Team after checkout is complete."
        : "We will open an email to sales@lightfast.ai to continue the Business plan conversation.";

  return (
    <Dialog onOpenChange={onOpenChange} open={!!change}>
      <DialogContent className="p-8 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Confirm plan changes</DialogTitle>
          <DialogDescription className="pt-6 text-xl leading-relaxed">
            {body}
          </DialogDescription>
        </DialogHeader>
        {change && (
          <div className="mt-4 rounded-xl border px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-lg">{change.title}</p>
                <p className="mt-2 text-muted-foreground">
                  {change.description}
                </p>
              </div>
              <p className="text-lg">{change.amountLabel}</p>
            </div>
          </div>
        )}
        <DialogFooter className="mt-8">
          <Button
            className="rounded-full px-7"
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          {change?.tier === "business" ? (
            <Button asChild className="rounded-full px-7">
              <a href="mailto:sales@lightfast.ai">Confirm</a>
            </Button>
          ) : (
            <Button
              className="rounded-full px-7"
              onClick={() => {
                if (change) {
                  onConfirm(change);
                }
              }}
              type="button"
            >
              Confirm
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BillingOrganization {
  addPaymentMethod?: (params: {
    gateway: "stripe";
    paymentToken: string;
  }) => Promise<unknown>;
  id?: string;
}

function PaymentMethodDialog({
  defaultPaymentMethod,
  isLoading,
  methods,
  onOpenChange,
  onUpdated,
  open,
  organization,
  orgId,
}: {
  defaultPaymentMethod: BillingPaymentMethod | null;
  isLoading: boolean;
  methods: BillingPaymentMethod[];
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  open: boolean;
  organization: BillingOrganization | null | undefined;
  orgId?: string;
}) {
  const [mode, setMode] = useState<"saved" | "new">("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateMethod(action: () => Promise<unknown> | undefined) {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await action();
      onUpdated();
    } catch (error) {
      setErrorMessage(paymentErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="p-8 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Payment method</DialogTitle>
          <DialogDescription>
            Update the saved payment methods Clerk uses for organization
            billing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-xl border px-4 py-4">
            <p className="text-muted-foreground text-sm">
              Current payment method
            </p>
            <p className="mt-2 font-medium">
              {cardLabel(defaultPaymentMethod)}
            </p>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {mode === "saved" ? (
            <>
              {isLoading ? (
                <LoadingLine label="Loading payment methods" />
              ) : methods.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No saved payment methods.
                </p>
              ) : (
                <div className="space-y-3">
                  {methods.map((method) => (
                    <div
                      className="flex items-center justify-between gap-4 rounded-lg border px-4 py-4"
                      key={method.id}
                    >
                      <div>
                        <p className="font-medium">{cardLabel(method)}</p>
                        <p className="mt-1 text-muted-foreground text-sm capitalize">
                          {method.isDefault ? "Default" : method.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!method.isDefault && (
                          <Button
                            disabled={isUpdating}
                            onClick={() =>
                              void updateMethod(() =>
                                method.makeDefault?.({ orgId })
                              )
                            }
                            size="sm"
                            variant="secondary"
                          >
                            Make default
                          </Button>
                        )}
                        {method.isRemovable && (
                          <Button
                            disabled={isUpdating}
                            onClick={() =>
                              void updateMethod(() =>
                                method.remove?.({ orgId })
                              )
                            }
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full"
                onClick={() => setMode("new")}
                variant="secondary"
              >
                Add new card
              </Button>
            </>
          ) : (
            <PaymentMethodForm
              onCancel={() => setMode("saved")}
              onError={setErrorMessage}
              onSaved={() => {
                onUpdated();
                setMode("saved");
              }}
              organization={organization}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentMethodForm({
  onCancel,
  onError,
  onSaved,
  organization,
}: {
  onCancel: () => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
  organization: BillingOrganization | null | undefined;
}) {
  return (
    <PaymentElementProvider for="organization">
      <NewPaymentMethodForm
        onCancel={onCancel}
        onError={onError}
        onSaved={onSaved}
        organization={organization}
      />
    </PaymentElementProvider>
  );
}

function NewPaymentMethodForm({
  onCancel,
  onError,
  onSaved,
  organization,
}: {
  onCancel: () => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
  organization: BillingOrganization | null | undefined;
}) {
  const { isFormReady, submit } = usePaymentElement();
  const [isSaving, setIsSaving] = useState(false);

  async function savePaymentMethod() {
    if (!isFormReady || isSaving) {
      return;
    }
    setIsSaving(true);
    onError(null);
    try {
      const result = await submit();
      if (result.error) {
        onError(paymentErrorMessage(result.error));
        return;
      }
      await organization?.addPaymentMethod?.({
        gateway: result.data.gateway,
        paymentToken: result.data.paymentToken,
      });
      onSaved();
    } catch (error) {
      onError(paymentErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        fallback={
          <div className="rounded-md border px-3 py-3 text-muted-foreground text-sm">
            Loading payment element...
          </div>
        }
      />
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          disabled={!isFormReady || isSaving}
          onClick={() => void savePaymentMethod()}
          type="button"
        >
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save card
        </Button>
      </DialogFooter>
    </div>
  );
}

function StatementDetailsDialog({
  onOpenChange,
  statement,
}: {
  onOpenChange: (open: boolean) => void;
  statement: BillingStatement | null;
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
            {statement.groups?.some((group) => group.items?.length) ? (
              <div className="space-y-2">
                {statement.groups.flatMap((group) =>
                  (group.items ?? []).map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={item.id ?? item.description}
                    >
                      <span>{item.description ?? "Invoice item"}</span>
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

function BillingCheckoutDialog({
  onComplete,
  onOpenChange,
  open,
  plan,
}: {
  onComplete: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plan: BillingPlan;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upgrade to Team</DialogTitle>
          <DialogDescription>
            Start the Team plan for {planAmountLabel(plan)}.
          </DialogDescription>
        </DialogHeader>
        <CheckoutProvider
          for="organization"
          planId={plan.id}
          planPeriod="month"
        >
          <CheckoutFlow onComplete={onComplete} />
        </CheckoutProvider>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutFlow({ onComplete }: { onComplete: () => void }) {
  const { checkout, fetchStatus } = useCheckout();
  const [paymentMode, setPaymentMode] = useState("saved");

  if (checkout.status === "needs_initialization") {
    return (
      <div className="rounded-lg border border-border/60 px-4 py-4">
        <p className="text-muted-foreground text-sm">
          Initialize checkout to review totals and payment options.
        </p>
        <Button
          className="mt-4"
          disabled={fetchStatus === "fetching"}
          onClick={() => void checkout.start()}
          size="sm"
        >
          {fetchStatus === "fetching" && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Start checkout
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CheckoutSummary />
      <div className="flex gap-2">
        <Button
          onClick={() => setPaymentMode("saved")}
          size="sm"
          variant={paymentMode === "saved" ? "secondary" : "outline"}
        >
          Use saved card
        </Button>
        <Button
          onClick={() => setPaymentMode("new")}
          size="sm"
          variant={paymentMode === "new" ? "secondary" : "outline"}
        >
          Use new card
        </Button>
      </div>
      {paymentMode === "saved" ? (
        <SavedPaymentCheckout onComplete={onComplete} />
      ) : (
        <PaymentElementProvider checkout={checkout}>
          <NewPaymentCheckout onComplete={onComplete} />
        </PaymentElementProvider>
      )}
    </div>
  );
}

function CheckoutSummary() {
  const { checkout } = useCheckout();
  if (!checkout.plan) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/60 px-4 py-4">
      <p className="font-medium text-sm">{checkout.plan.name}</p>
      <p className="mt-1 text-muted-foreground text-sm">
        Due now {formatMoney(checkout.totals.totalDueNow)}
      </p>
    </div>
  );
}

function SavedPaymentCheckout({ onComplete }: { onComplete: () => void }) {
  const { checkout, errors, fetchStatus } = useCheckout();
  const paymentMethods = usePaymentMethods({
    for: "organization",
    pageSize: 20,
  });
  const methods = (paymentMethods.data ?? []) as BillingPaymentMethod[];
  const defaultMethod = useMemo(
    () => methods.find((method) => method.isDefault) ?? methods[0],
    [methods]
  );
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedMethod = methods.find(
    (method) => method.id === (selectedMethodId ?? defaultMethod?.id)
  );

  async function submitSelectedMethod() {
    const paymentMethodId = selectedMethodId ?? defaultMethod?.id;
    if (!paymentMethodId || fetchStatus === "fetching") {
      return;
    }
    setErrorMessage(null);
    const result = await checkout.confirm({ paymentMethodId });
    if (result.error) {
      setErrorMessage(checkoutErrorMessage(result.error));
      return;
    }
    await checkout.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.href = decorateUrl(window.location.pathname);
      },
    });
    onComplete();
  }

  return (
    <div className="space-y-4">
      {paymentMethods.isLoading ? (
        <LoadingLine label="Loading saved cards" />
      ) : methods.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No saved payment methods. Use a new card to continue.
        </p>
      ) : (
        <div className="space-y-2">
          {methods.map((method) => (
            <button
              className={`flex w-full items-center justify-between rounded-md border px-3 py-3 text-left text-sm ${
                selectedMethod?.id === method.id
                  ? "border-foreground"
                  : "border-border/60"
              }`}
              key={method.id}
              onClick={() => setSelectedMethodId(method.id)}
              type="button"
            >
              <span>{cardLabel(method)}</span>
              {method.isDefault && <Badge variant="secondary">Default</Badge>}
            </button>
          ))}
        </div>
      )}
      <CheckoutErrors errorMessage={errorMessage} errors={errors.global} />
      <Button
        disabled={!defaultMethod || fetchStatus === "fetching"}
        onClick={() => void submitSelectedMethod()}
        size="sm"
      >
        {fetchStatus === "fetching" && (
          <Loader2 className="size-4 animate-spin" />
        )}
        Complete Purchase
      </Button>
    </div>
  );
}

function NewPaymentCheckout({ onComplete }: { onComplete: () => void }) {
  const { checkout, errors, fetchStatus } = useCheckout();
  const { isFormReady, submit } = usePaymentElement();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmitting = isProcessing || fetchStatus === "fetching";

  async function submitNewMethod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormReady || isSubmitting) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const paymentResult = await submit();
      if (paymentResult.error) {
        setErrorMessage(checkoutErrorMessage(paymentResult.error));
        return;
      }
      const confirmResult = await checkout.confirm(paymentResult.data);
      if (confirmResult.error) {
        setErrorMessage(checkoutErrorMessage(confirmResult.error));
        return;
      }
      await checkout.finalize({
        navigate: ({ decorateUrl }) => {
          window.location.href = decorateUrl(window.location.pathname);
        },
      });
      onComplete();
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submitNewMethod}>
      <PaymentElement
        fallback={
          <div className="rounded-md border border-border/60 px-3 py-3 text-muted-foreground text-sm">
            Loading payment element...
          </div>
        }
      />
      <CheckoutErrors errorMessage={errorMessage} errors={errors.global} />
      <Button disabled={!isFormReady || isSubmitting} size="sm" type="submit">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Pay with new card
      </Button>
    </form>
  );
}

function CheckoutErrors({
  errorMessage,
  errors,
}: {
  errorMessage: string | null;
  errors:
    | Array<{ longMessage?: string | null; message?: string | null }>
    | null
    | undefined;
}) {
  const messages = [
    ...(errorMessage ? [errorMessage] : []),
    ...(errors ?? []).map(
      (error) => error.longMessage ?? error.message ?? "Checkout failed"
    ),
  ];
  if (messages.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription>
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}
