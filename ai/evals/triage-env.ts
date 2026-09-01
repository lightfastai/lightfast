interface TriageEvalEnvironment {
  TRIAGE_EVAL_MODE?: string;
  VERCEL_OIDC_TOKEN?: string;
  [key: string]: string | undefined;
}

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
      "VERCEL_OIDC_TOKEN is required for live triage evals. Configure it in the ignored ai/.env.local file, then run `pnpm --filter @repo/ai eval:triage`."
    );
  }
}
