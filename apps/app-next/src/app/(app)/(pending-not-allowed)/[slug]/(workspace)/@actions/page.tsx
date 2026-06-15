// Slot index — matches the 0-segment workspace root (/[slug]), which the
// catch-all does not match. Returning null clears the topbar actions region
// when soft-navigating to the workspace root. (The Next.js Modals example pairs
// an @auth/page.tsx with @auth/[...catchAll]/page.tsx for exactly this split.)
export default function WorkspaceActionsIndex() {
  return null;
}
