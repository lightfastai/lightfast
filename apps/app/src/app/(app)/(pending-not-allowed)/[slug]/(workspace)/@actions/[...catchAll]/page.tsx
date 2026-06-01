// Catch-all — matches 1+ trailing segments (/automations, /automations/[id],
// /settings/**, …) that have no dedicated slot. On soft navigation this resolves
// to a real null-rendering match instead of retaining the last switcher.
// `default.tsx` only runs on hard load, so without this the slot would leak.
export default function WorkspaceActionsCatchAll() {
  return null;
}
