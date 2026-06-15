import type { AppRouterOutputs } from "@api/app";

export type AutomationList =
  AppRouterOutputs["org"]["workspace"]["automations"]["list"];
export type AutomationListItem = AutomationList[number];

export interface AutomationSection {
  automations: AutomationListItem[];
  title: "Current" | "Paused";
}

export function hasAutomations(automations: AutomationListItem[]): boolean {
  return automations.length > 0;
}

export function getAutomationSections(
  automations: AutomationListItem[]
): AutomationSection[] {
  const currentAutomations = automations.filter(
    (automation) => automation.status === "active"
  );
  const pausedAutomations = automations.filter(
    (automation) => automation.status === "paused"
  );
  const sections: AutomationSection[] = [];

  if (currentAutomations.length > 0) {
    sections.push({ automations: currentAutomations, title: "Current" });
  }
  if (pausedAutomations.length > 0) {
    sections.push({ automations: pausedAutomations, title: "Paused" });
  }

  return sections;
}
