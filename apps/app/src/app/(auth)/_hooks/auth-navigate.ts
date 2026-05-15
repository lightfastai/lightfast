interface FinalizeNavigateParams {
  decorateUrl: (u: string) => string;
  session?: { currentTask?: unknown } | null;
}

// Clerk's signIn/signUp/setActive `navigate` callback. If the new session has
// a currentTask (force-MFA, accept-org-invite, etc.), let Clerk handle the
// task navigation by returning early. Otherwise route to `target`.
export function makeFinalizeNavigate(target: string) {
  return (params: FinalizeNavigateParams) => {
    if (params.session?.currentTask) {
      return;
    }
    window.location.href = params.decorateUrl(target);
  };
}
