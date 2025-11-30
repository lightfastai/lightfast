"use client";

import { parseAsString, parseAsStringEnum, parseAsArrayOf, useQueryStates } from "nuqs";

/**
 * Search params hook for early access form
 *
 * Manages URL query parameters for multi-step form:
 * - step: Current form step (email, company, sources)
 * - email: User's email address
 * - companySize: Selected company size
 * - sources: Selected data sources (comma-separated)
 */
export function useEarlyAccessParams() {
  return useQueryStates(
    {
      step: parseAsStringEnum<"email" | "company" | "sources">(["email", "company", "sources"])
        .withDefault("email"),
      email: parseAsString.withDefault(""),
      companySize: parseAsString.withDefault(""),
      sources: parseAsArrayOf(parseAsString, ",").withDefault([]),
    },
    {
      shallow: true,
      history: "push",
    }
  );
}
