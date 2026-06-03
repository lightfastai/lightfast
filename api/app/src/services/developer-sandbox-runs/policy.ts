interface DeveloperSandboxCommandInput {
  cmd: string;
  args?: string[];
}

interface AllowedPolicyResult {
  allowed: true;
}

interface DeniedPolicyResult {
  allowed: false;
  ruleId: string;
  reason: string;
}

export type DeveloperSandboxCommandPolicyResult =
  | AllowedPolicyResult
  | DeniedPolicyResult;

interface DefaultDenyRule {
  provider: "pscale" | "upstash" | "sentry" | "clerk";
  providerName: string;
  action: "login" | "logout";
}

const DEFAULT_DENY_RULES: DefaultDenyRule[] = [
  { provider: "pscale", providerName: "PlanetScale", action: "login" },
  { provider: "pscale", providerName: "PlanetScale", action: "logout" },
  { provider: "upstash", providerName: "Upstash", action: "login" },
  { provider: "upstash", providerName: "Upstash", action: "logout" },
  { provider: "sentry", providerName: "Sentry", action: "login" },
  { provider: "sentry", providerName: "Sentry", action: "logout" },
  { provider: "clerk", providerName: "Clerk", action: "login" },
  { provider: "clerk", providerName: "Clerk", action: "logout" },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCommandTextForPolicy(
  input: DeveloperSandboxCommandInput,
) {
  return [input.cmd, ...(input.args ?? [])]
    .join(" ")
    .replace(/["'`]/g, " ")
    .replace(/&&|\|\||[;\n\r]/g, " ; ")
    .replace(/\s+/g, " ")
    .trim();
}

function ruleRegex(rule: DefaultDenyRule) {
  const provider = escapeRegExp(rule.provider);
  const action = escapeRegExp(rule.action);

  return new RegExp(
    [
      "(^|\\s|;)",
      "(?:",
      "npx\\s+(?:--yes\\s+)?",
      "|pnpm\\s+(?:dlx|exec)\\s+",
      "|npm\\s+exec\\s+",
      ")?",
      provider,
      "\\s+auth\\s+",
      action,
      "(?=$|\\s|;)",
    ].join(""),
    "i",
  );
}

export function evaluateDeveloperSandboxCommandPolicy(
  input: DeveloperSandboxCommandInput,
): DeveloperSandboxCommandPolicyResult {
  const commandText = normalizeCommandTextForPolicy(input);

  for (const rule of DEFAULT_DENY_RULES) {
    if (!ruleRegex(rule).test(commandText)) {
      continue;
    }

    return {
      allowed: false,
      ruleId: `lightfast_default.${rule.provider}.auth_${rule.action}`,
      reason: `${rule.providerName} auth ${rule.action} is managed by Lightfast.`,
    };
  }

  return { allowed: true };
}
