import type { AppRouterOutputs } from "@api/app";

export type PeopleList = AppRouterOutputs["org"]["workspace"]["people"]["list"];
export type PersonRow = PeopleList["items"][number];
export type PersonProvider = PersonRow["identityProvider"];
export type PersonSource = PersonRow["personSource"];
export type PersonType = PersonRow["identityType"];
export type PersonMemberStatus = NonNullable<PersonRow["memberStatus"]>;

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

export const peopleSourceOptions: {
  label: string;
  value: PersonSource;
}[] = [
  { label: "Signal-discovered", value: "signal" },
  { label: "Team member", value: "team_member" },
  { label: "Mixed", value: "mixed" },
];

export const peopleMemberStatusOptions: {
  label: string;
  value: PersonMemberStatus;
}[] = [
  { label: "Active member", value: "active" },
  { label: "Former member", value: "former" },
];

export interface PeopleClassificationFilters {
  memberStatuses: PersonMemberStatus[];
  providers: PersonProvider[];
  sources: PersonSource[];
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

export function getPersonSourceLabel(source: PersonSource) {
  return (
    peopleSourceOptions.find((option) => option.value === source)?.label ??
    source
  );
}

export function getMemberStatusLabel(status: PersonMemberStatus) {
  return (
    peopleMemberStatusOptions.find((option) => option.value === status)
      ?.label ?? status
  );
}

/**
 * Short, display-only signal reference derived from a signal public id
 * (`signal_<uuid>` → `SIG-3F9A`). The full public id is still used for links;
 * this is only a compact label. Reworked when a person↔signal join exists.
 */
export function formatPersonSignalRef(signalId: string) {
  const raw = signalId.startsWith("signal_") ? signalId.slice(7) : signalId;
  const short = raw.replace(/-/g, "").slice(0, 4).toUpperCase();
  return short ? `SIG-${short}` : "Signal";
}

/**
 * The Signals column derives from the only two linkable refs plus the count.
 * `ref` is the most recent linkable signal; `more` is the count of additional
 * mentions (NOT a list we can expand — see the Honesty Constraint in the spec).
 */
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
