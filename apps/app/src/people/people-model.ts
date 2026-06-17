import type { PeopleList, PersonRow } from "./people-queries";

export type { PeopleList, PersonRow } from "./people-queries";

export type PersonProvider = PersonRow["identityProvider"];
export type PersonType = PersonRow["identityType"];

export const PEOPLE_PAGE_SIZE = 50;

export const peopleProviderOptions: {
  label: string;
  value: PersonProvider;
}[] = [
  { label: "Email", value: "email" },
  { label: "X", value: "x" },
  { label: "GitHub", value: "github" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Website", value: "website" },
];

export const peopleTypeOptions: {
  label: string;
  value: PersonType;
}[] = [
  { label: "Email", value: "email" },
  { label: "Handle", value: "handle" },
  { label: "Profile URL", value: "profile_url" },
];

export interface PeopleClassificationFilters {
  providers: PersonProvider[];
  types: PersonType[];
}

export function getPersonName(person: PersonRow) {
  return person.displayName ?? person.identityValue;
}

export function getPersonProviderLabel(provider: PersonProvider) {
  return (
    peopleProviderOptions.find((option) => option.value === provider)?.label ??
    provider
  );
}

export function getPersonTypeLabel(type: PersonType) {
  return (
    peopleTypeOptions.find((option) => option.value === type)?.label ?? type
  );
}

export function formatPersonSignalRef(signalId: string) {
  const raw = signalId.startsWith("signal_") ? signalId.slice(7) : signalId;
  const short = raw.replace(/-/g, "").slice(0, 4).toUpperCase();
  return short ? `SIG-${short}` : "Signal";
}

export function getPersonSignals(person: PersonRow): {
  ref: string | null;
  more: number;
} {
  const ref = person.lastSeenSignalId ?? person.firstSeenSignalId ?? null;
  const more = Math.max(0, person.seenCount - 1);
  return { ref, more };
}

export function flattenPeoplePages(data: { pages: PeopleList[] } | undefined) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}
