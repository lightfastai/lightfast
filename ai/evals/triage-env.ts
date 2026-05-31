type TriageEvalEnvironment = {
  [key: string]: string | undefined;
  TRIAGE_EVAL_MODE?: string;
  VERCEL_OIDC_TOKEN?: string;
};

export function isTriageEvalFixtureMode(env: TriageEvalEnvironment): boolean {
  return env.TRIAGE_EVAL_MODE === "expected";
}

export function assertLiveTriageEvalEnvironment(
  env: TriageEvalEnvironment
): void {
  if (isTriageEvalFixtureMode(env)) {
    return;
  }

  if (!env.VERCEL_OIDC_TOKEN) {
    throw new Error(
      "VERCEL_OIDC_TOKEN is required for live triage evals. Run `pnpm --filter @repo/ai eval:triage` so the app Vercel env is loaded, or refresh it with `cd apps/app && vercel env pull .vercel/.env.development.local`."
    );
  }
}
