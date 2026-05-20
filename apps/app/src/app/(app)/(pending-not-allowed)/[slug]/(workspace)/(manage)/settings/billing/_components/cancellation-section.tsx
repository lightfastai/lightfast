import { Button } from "@repo/ui/components/ui/button";

export function CancellationSection({
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
