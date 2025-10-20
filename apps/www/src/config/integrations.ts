/**
 * List of integrations available in Lightfast
 * Used for display on landing page and integration showcases
 */
export const INTEGRATIONS = [
  {
    id: "github",
    name: "GitHub",
    slug: "github",
  },
  {
    id: "linear",
    name: "Linear",
    slug: "linear",
  },
  {
    id: "notion",
    name: "Notion",
    slug: "notion",
  },
  {
    id: "docs",
    name: "Google Docs",
    slug: "docs",
  },
  {
    id: "sheet",
    name: "Google Sheets",
    slug: "sheet",
  },
  {
    id: "drive",
    name: "Google Drive",
    slug: "drive",
  },
  {
    id: "gmail",
    name: "Gmail",
    slug: "gmail",
  },
  {
    id: "airtable",
    name: "Airtable",
    slug: "airtable",
  },
  {
    id: "slack",
    name: "Slack",
    slug: "slack",
  },
  {
    id: "discord",
    name: "Discord",
    slug: "discord",
  },
  {
    id: "datadog",
    name: "Datadog",
    slug: "datadog",
  },
  {
    id: "sentry",
    name: "Sentry",
    slug: "sentry",
  },
  {
    id: "loops",
    name: "Loops",
    slug: "loops",
  },
  {
    id: "metabase",
    name: "Metabase",
    slug: "metabase",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    slug: "gcal",
  },
] as const;

export type Integration = (typeof INTEGRATIONS)[number];
