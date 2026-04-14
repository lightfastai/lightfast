import type {
  IntegrationCategory,
  IntegrationStatus,
} from "~/lib/content-schemas";

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  "dev-tools": "Dev tools",
  monitoring: "Monitoring",
  comms: "Comms",
  data: "Data",
  "project-management": "Project management",
};

export const STATUS_LABEL: Record<
  NonNullable<IntegrationStatus> | "live",
  string
> = {
  live: "Live",
  beta: "Beta",
  "coming-soon": "Coming soon",
};
