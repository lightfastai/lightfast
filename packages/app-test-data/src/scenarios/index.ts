import type { LocalE2EScenario } from "../types";
import { githubPrClosedScenario } from "./github-pr-closed";
import { vercelDeploymentSucceededScenario } from "./vercel-deployment-succeeded";

export const scenarios: LocalE2EScenario[] = [
  githubPrClosedScenario,
  vercelDeploymentSucceededScenario,
];

export function getScenario(name: string): LocalE2EScenario {
  const scenario = scenarios.find((candidate) => candidate.name === name);
  if (!scenario) {
    const known = scenarios.map((candidate) => candidate.name).join(", ");
    throw new Error(`Unknown scenario "${name}". Known scenarios: ${known}`);
  }
  return scenario;
}
