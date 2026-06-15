// Automations list — no back affordance. Explicit null match so the @actions
// slot fully enumerates the automations subtree (list/new/[automationId])
// instead of leaning on the catch-all, which can't distinguish them.
export default function AutomationsActionsSlot() {
  return null;
}
