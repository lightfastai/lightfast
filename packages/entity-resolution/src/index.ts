import { z } from "zod";

export {
  type EntityResolutionPersistenceBatch,
  type EntityResolutionPersistenceCandidateGroup,
  type EntityResolutionPersistenceSourceIdentity,
  entityResolutionResultToPersistenceBatch,
} from "./persistence";

export const ENTITY_RESOLUTION_STATUSES = [
  "confirmed",
  "likely",
  "possible",
  "conflicting",
  "rejected",
] as const;

export const entityResolutionStatusSchema = z.enum(ENTITY_RESOLUTION_STATUSES);
export type EntityResolutionStatus = z.infer<
  typeof entityResolutionStatusSchema
>;

export const sourceProviderSchema = z.enum([
  "x",
  "github",
  "website",
  "domain",
]);
export type SourceProvider = z.infer<typeof sourceProviderSchema>;

export const sourceIdentityTypeSchema = z.enum([
  "handle",
  "profile_url",
  "url",
  "domain",
  "org_handle",
]);
export type SourceIdentityType = z.infer<typeof sourceIdentityTypeSchema>;

export interface SourceIdentity {
  key: string;
  provider: SourceProvider;
  type: SourceIdentityType;
  url?: string;
  value: string;
}

export type EvidenceKind =
  | "source.identity"
  | "person.name"
  | "person.location"
  | "person.cross_link"
  | "person.affiliation"
  | "business.name"
  | "business.domain";

export interface EntityEvidence {
  confidence: number;
  id: string;
  kind: EvidenceKind;
  observedAt?: string;
  source: {
    field: string;
    provider: "x" | "github";
    sourceIdentityKey?: string;
  };
  value: string;
}

export interface EntityConflict {
  kind: "business.affiliation";
  values: string[];
}

export type AffiliationRelationship = "current" | "historical";

export interface ResolvedPersonAffiliation {
  businessName: string;
  confidence: number;
  evidence: EntityEvidence[];
  relationship: AffiliationRelationship;
  status: EntityResolutionStatus;
}

export interface ResolvedPersonCandidate {
  affiliations: ResolvedPersonAffiliation[];
  confidence: number;
  conflicts: EntityConflict[];
  displayName: string;
  evidence: EntityEvidence[];
  sourceIdentities: SourceIdentity[];
  status: EntityResolutionStatus;
}

export interface ResolvedBusinessCandidate {
  confidence: number;
  displayName: string;
  domains: string[];
  evidence: EntityEvidence[];
  sourceIdentities: SourceIdentity[];
  status: EntityResolutionStatus;
}

export interface EntityResolutionResult {
  businesses: ResolvedBusinessCandidate[];
  people: ResolvedPersonCandidate[];
}

export interface KnownXGitHubPairSeed {
  displayName: string;
  githubBio?: string;
  githubBlog?: string;
  githubCompany?: string;
  githubLogin: string;
  location?: string;
  xUsername: string;
}

export interface SimulatedEntityScenario {
  id: string;
  observations: EntityObservation[];
}

export const KNOWN_X_GITHUB_PAIR_SEEDS = [
  seed({
    displayName: "Sindre Sorhus",
    githubBlog: "https://sindresorhus.com/apps",
    githubLogin: "sindresorhus",
    xUsername: "sindresorhus",
  }),
  seed({
    displayName: "Addy Osmani",
    githubBlog: "https://www.addyosmani.com",
    githubCompany: "Google",
    githubLogin: "addyosmani",
    xUsername: "addyosmani",
  }),
  seed({
    displayName: "Kent C. Dodds",
    githubBlog: "https://kentcdodds.com",
    githubCompany: "@epicweb-dev",
    githubLogin: "kentcdodds",
    xUsername: "kentcdodds",
  }),
  seed({
    displayName: "Wes Bos",
    githubBlog: "www.wesbos.com",
    githubCompany: "me",
    githubLogin: "wesbos",
    xUsername: "wesbos",
  }),
  seed({
    displayName: "Jason Miller",
    githubBlog: "https://jasonformat.com",
    githubCompany: "@Shopify",
    githubLogin: "developit",
    xUsername: "_developit",
  }),
  seed({
    displayName: "Yehuda Katz",
    githubBlog: "http://yehudakatz.com",
    githubCompany: "@heroku",
    githubLogin: "wycats",
    xUsername: "wycats",
  }),
  seed({
    displayName: "Evan You",
    githubBlog: "http://evanyou.me",
    githubCompany: "VoidZero",
    githubLogin: "yyx990803",
    xUsername: "evanyou",
  }),
  seed({
    displayName: "Michael Jackson",
    githubBlog: "https://remix.run",
    githubCompany: "@Shopify",
    githubLogin: "mjackson",
    xUsername: "mjackson",
  }),
  seed({
    displayName: "Ryan Florence",
    githubBlog: "http://remix.run",
    githubCompany: "@Shopify",
    githubLogin: "ryanflorence",
    xUsername: "ryanflorence",
  }),
  seed({
    displayName: "shadcn",
    githubCompany: "@vercel",
    githubLogin: "shadcn",
    xUsername: "shadcn",
  }),
  seed({
    displayName: "Mattt",
    githubBlog: "https://nshipster.com",
    githubLogin: "mattt",
    xUsername: "mattt",
  }),
  seed({
    displayName: "John Resig",
    githubBlog: "https://johnresig.com/",
    githubCompany: "@Khan",
    githubLogin: "jeresig",
    xUsername: "jeresig",
  }),
  seed({
    displayName: "David Heinemeier Hansson",
    githubBlog: "https://dhh.dk",
    githubCompany: "37signals",
    githubLogin: "dhh",
    xUsername: "dhh",
  }),
  seed({
    displayName: "Jared Palmer",
    githubBlog: "https://jaredpalmer.com",
    githubCompany: "Xbox @Microsoft",
    githubLogin: "jaredpalmer",
    xUsername: "jaredpalmer",
  }),
  seed({
    displayName: "Sunil Pai",
    githubBlog: "https://sunilpai.dev",
    githubCompany: "Cloudflare, Inc.",
    githubLogin: "threepointone",
    xUsername: "threepointone",
  }),
  seed({
    displayName: "Tanner Linsley",
    githubBlog: "https://tanstack.com",
    githubCompany: "@tanstack & @nozzle",
    githubLogin: "tannerlinsley",
    xUsername: "tannerlinsley",
  }),
  seed({
    displayName: "Ben Awad",
    githubBlog: "https://voidpet.com",
    githubCompany: "Voidpet",
    githubLogin: "benawad",
    xUsername: "benawad",
  }),
  seed({
    displayName: "ThePrimeagen",
    githubBlog: "http://twitch.tv/ThePrimeagen",
    githubCompany: "CEO Of TheStartup",
    githubLogin: "ThePrimeagen",
    xUsername: "ThePrimeagen",
  }),
  seed({
    displayName: "Armin Ronacher",
    githubBlog: "https://lucumr.pocoo.org/",
    githubCompany: "Earendil",
    githubLogin: "mitsuhiko",
    xUsername: "mitsuhiko",
  }),
  seed({
    displayName: "Feross Aboukhadijeh",
    githubBlog: "https://feross.org",
    githubCompany: "@SocketDev, @WebTorrent, @Standard",
    githubLogin: "feross",
    xUsername: "feross",
  }),
] as const satisfies readonly KnownXGitHubPairSeed[];

export const SIMULATED_ENTITY_SCENARIOS = [
  scenario("clean-cross-link", [
    xProfile({
      description: "Head of AI at Acme. Building agent workflows.",
      id: "sim_x_ava",
      location: "San Francisco",
      name: "Ava Chen",
      url: "https://acme.com",
      username: "ava_ai",
    }),
    githubProfile({
      blog: "https://acme.com/team/ava",
      company: "@acme",
      id: "sim_gh_ava",
      location: "San Francisco",
      login: "avachen",
      name: "Ava Chen",
      twitterUsername: "ava_ai",
    }),
  ]),
  scenario("different-handles", [
    xProfile({
      description: "Founder at Vectorloop.",
      id: "sim_x_noor",
      name: "Noor Malik",
      url: "https://vectorloop.dev",
      username: "noor_ai",
    }),
    githubProfile({
      blog: "https://vectorloop.dev/noor",
      company: "Vectorloop",
      id: "sim_gh_noor",
      login: "nmalik-dev",
      name: "Noor Malik",
      twitterUsername: "noor_ai",
    }),
  ]),
  scenario("x-only-founder", [
    xProfile({
      description: "CEO at LumenDesk.",
      id: "sim_x_lena",
      location: "New York",
      name: "Lena Ortiz",
      url: "https://lumendesk.com",
      username: "lena_builds",
    }),
  ]),
  scenario("github-only-maintainer", [
    githubProfile({
      blog: "https://rhea.dev",
      company: "@open-source-labs",
      id: "sim_gh_rhea",
      location: "Berlin",
      login: "rhea-maintains",
      name: "Rhea Singh",
    }),
  ]),
  scenario("conflicting-affiliation", [
    xProfile({
      description: "Founder at Orbit Labs.",
      id: "sim_x_mira",
      name: "Mira Patel",
      url: "https://orbitlabs.example",
      username: "mira_agents",
    }),
    githubProfile({
      blog: "https://northstar.ai/team/mira",
      company: "@northstar-ai",
      id: "sim_gh_mira",
      login: "mirap",
      name: "Mira Patel",
      twitterUsername: "mira_agents",
    }),
  ]),
  scenario("pseudonymous-x", [
    xProfile({
      description: "Experiments with agent memory and eval loops.",
      id: "sim_x_agentloop",
      name: "agentloop",
      username: "agentloop",
    }),
  ]),
  scenario("stale-github-company", [
    xProfile({
      description: "Design partner at Freshflow.",
      id: "sim_x_tomas",
      name: "Tomas Reed",
      url: "https://freshflow.ai",
      username: "tomas_reed",
    }),
    githubProfile({
      blog: "https://tomasreed.dev",
      company: "ex-OldCRM",
      id: "sim_gh_tomas",
      login: "tomasreed",
      name: "Tomas Reed",
      twitterUsername: "tomas_reed",
    }),
  ]),
  scenario("domain-only-business", [
    githubProfile({
      blog: "https://signalforge.dev",
      id: "sim_gh_ivy",
      login: "ivy-signal",
      name: "Ivy Brooks",
      twitterUsername: "ivy_signal",
    }),
    xProfile({
      description: "Building quiet CRM automations.",
      id: "sim_x_ivy",
      name: "Ivy Brooks",
      url: "https://signalforge.dev",
      username: "ivy_signal",
    }),
  ]),
] as const satisfies readonly SimulatedEntityScenario[];

const optionalStringSchema = z.string().trim().min(1).optional();
const optionalNullableStringSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional();

export const xProfileObservationSchema = z
  .object({
    observedAt: optionalStringSchema,
    profile: z
      .object({
        description: optionalNullableStringSchema,
        id: z.string().trim().min(1),
        location: optionalNullableStringSchema,
        name: optionalNullableStringSchema,
        url: optionalNullableStringSchema,
        username: z.string().trim().min(1),
      })
      .strict(),
    provider: z.literal("x"),
  })
  .strict();
export type XProfileObservation = z.infer<typeof xProfileObservationSchema>;

export const githubProfileObservationSchema = z
  .object({
    observedAt: optionalStringSchema,
    profile: z
      .object({
        bio: optionalNullableStringSchema,
        blog: optionalNullableStringSchema,
        company: optionalNullableStringSchema,
        email: optionalNullableStringSchema,
        id: z.union([z.string().trim().min(1), z.number()]),
        location: optionalNullableStringSchema,
        login: z.string().trim().min(1),
        name: optionalNullableStringSchema,
        twitterUsername: optionalNullableStringSchema,
      })
      .strict(),
    provider: z.literal("github"),
  })
  .strict();
export type GitHubProfileObservation = z.infer<
  typeof githubProfileObservationSchema
>;

export const entityObservationSchema = z.union([
  xProfileObservationSchema,
  githubProfileObservationSchema,
]);
export type EntityObservation = z.infer<typeof entityObservationSchema>;

export const resolveEntityCandidatesInputSchema = z
  .object({
    observations: z.array(entityObservationSchema),
  })
  .strict();
export type ResolveEntityCandidatesInput = z.infer<
  typeof resolveEntityCandidatesInputSchema
>;

interface ProfileBundle {
  businessClaims: BusinessClaim[];
  displayName?: string;
  evidence: EntityEvidence[];
  identities: SourceIdentity[];
  location?: string;
  observedAt?: string;
  provider: "x" | "github";
  sourceIdentity: SourceIdentity;
  xHandle?: string;
}

interface BusinessClaim {
  confidence: number;
  displayName: string;
  domain?: string;
  evidence: EntityEvidence[];
  identities: SourceIdentity[];
  provider: "x" | "github";
  relationship: AffiliationRelationship;
}

interface CompanyNameClaim {
  name: string;
  relationship: AffiliationRelationship;
}

export function sourceIdentityKey(input: {
  provider: SourceProvider;
  type: SourceIdentityType;
  value: string;
}): string {
  return `${input.provider}:${input.type}:${input.value.trim().toLowerCase()}`;
}

export function normalizeHandle(
  provider: Extract<SourceProvider, "x" | "github">,
  value: string
): SourceIdentity | undefined {
  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  if (!normalized || /[\s/]/.test(normalized)) {
    return;
  }

  return {
    key: sourceIdentityKey({ provider, type: "handle", value: normalized }),
    provider,
    type: "handle",
    value: normalized,
  };
}

export function normalizeProfileUrl(
  provider: Extract<SourceProvider, "x" | "github">,
  value: string
): SourceIdentity | undefined {
  const url = parseUrl(value);
  if (!url) {
    return;
  }

  url.hash = "";
  url.search = "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const handle = url.pathname.split("/").filter(Boolean)[0];
  if (!handle) {
    return;
  }

  if (provider === "x" && ["x.com", "twitter.com"].includes(host)) {
    return normalizeHandle("x", handle);
  }

  if (provider === "github" && host === "github.com") {
    return normalizeHandle("github", handle);
  }

  return;
}

export function resolveEntityStatus(input: {
  confidence: number;
  confirmed?: boolean;
  conflicting?: boolean;
  rejected?: boolean;
}): EntityResolutionStatus {
  if (input.rejected || input.confidence <= 0) {
    return "rejected";
  }
  if (input.conflicting) {
    return "conflicting";
  }
  if (input.confirmed) {
    return "confirmed";
  }
  return input.confidence >= 0.75 ? "likely" : "possible";
}

export function resolveEntityCandidates(
  input: ResolveEntityCandidatesInput
): EntityResolutionResult {
  const parsed = resolveEntityCandidatesInputSchema.parse(input);
  const bundles = parsed.observations.map(toProfileBundle).filter(isDefined);
  const groups = groupProfiles(bundles);
  const people = groups.map(resolvePersonGroup);
  const businesses = resolveBusinesses(people);

  return {
    businesses,
    people,
  };
}

export function resolveKnownXGitHubPairFixture(): EntityResolutionResult {
  return resolveEntityCandidates({
    observations: KNOWN_X_GITHUB_PAIR_SEEDS.flatMap((pair) =>
      knownPairToObservations(pair)
    ),
  });
}

export function resolveSimulatedEntityFixture(): EntityResolutionResult {
  return resolveEntityCandidates({
    observations: SIMULATED_ENTITY_SCENARIOS.flatMap(
      (scenario) => scenario.observations
    ),
  });
}

export function serializeEntityResolutionResult(
  result: EntityResolutionResult,
  input: { pretty?: boolean } = {}
): string {
  const stableResult: EntityResolutionResult = {
    people: [...result.people].sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    ),
    businesses: [...result.businesses].sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    ),
  };
  const spacing = input.pretty === false ? undefined : 2;
  return `${JSON.stringify(stableResult, null, spacing)}\n`;
}

function knownPairToObservations(
  pair: KnownXGitHubPairSeed
): [XProfileObservation, GitHubProfileObservation] {
  const observedAt = "2026-06-06T00:00:00.000Z";
  return [
    {
      observedAt,
      profile: {
        description: syntheticXDescription(pair),
        id: `seed:x:${pair.xUsername.toLowerCase()}`,
        location: pair.location,
        name: pair.displayName,
        username: pair.xUsername,
      },
      provider: "x",
    },
    {
      observedAt,
      profile: {
        bio: pair.githubBio,
        blog: pair.githubBlog,
        company: pair.githubCompany,
        id: `seed:github:${pair.githubLogin.toLowerCase()}`,
        location: pair.location,
        login: pair.githubLogin,
        name: pair.displayName,
        twitterUsername: pair.xUsername,
      },
      provider: "github",
    },
  ];
}

function syntheticXDescription(pair: KnownXGitHubPairSeed): string | undefined {
  const companyClaim = companyNameFromGitHubCompany(pair.githubCompany);
  return companyClaim
    ? `${pair.displayName} at ${companyClaim.name}.`
    : undefined;
}

function seed(input: KnownXGitHubPairSeed): KnownXGitHubPairSeed {
  return input;
}

function scenario(
  id: string,
  observations: EntityObservation[]
): SimulatedEntityScenario {
  return { id, observations };
}

function xProfile(
  profile: XProfileObservation["profile"]
): XProfileObservation {
  return {
    observedAt: "2026-06-06T00:00:00.000Z",
    profile,
    provider: "x",
  };
}

function githubProfile(
  profile: GitHubProfileObservation["profile"]
): GitHubProfileObservation {
  return {
    observedAt: "2026-06-06T00:00:00.000Z",
    profile,
    provider: "github",
  };
}

function toProfileBundle(
  observation: EntityObservation
): ProfileBundle | undefined {
  if (observation.provider === "x") {
    return xProfileBundle(observation);
  }
  return githubProfileBundle(observation);
}

function xProfileBundle(observation: XProfileObservation): ProfileBundle {
  const handleIdentity =
    normalizeHandle("x", observation.profile.username) ??
    requiredIdentity("x", "handle", observation.profile.username);
  const identities = [handleIdentity];
  const evidence: EntityEvidence[] = [
    makeEvidence({
      confidence: 0.92,
      field: "profile.username",
      kind: "source.identity",
      observedAt: observation.observedAt,
      provider: "x",
      sourceIdentityKey: handleIdentity.key,
      value: handleIdentity.value,
    }),
  ];

  const name = cleanString(observation.profile.name);
  if (name) {
    evidence.push(
      makeEvidence({
        confidence: 0.7,
        field: "profile.name",
        kind: "person.name",
        observedAt: observation.observedAt,
        provider: "x",
        sourceIdentityKey: handleIdentity.key,
        value: name,
      })
    );
  }

  const location = cleanString(observation.profile.location);
  if (location) {
    evidence.push(
      makeEvidence({
        confidence: 0.45,
        field: "profile.location",
        kind: "person.location",
        observedAt: observation.observedAt,
        provider: "x",
        sourceIdentityKey: handleIdentity.key,
        value: location,
      })
    );
  }

  const businessClaims = buildBusinessClaims({
    companyClaim: currentCompanyClaim(
      companyNameFromBio(observation.profile.description ?? "")
    ),
    provider: "x",
    sourceField: "profile.description",
    sourceIdentity: handleIdentity,
    url: observation.profile.url ?? undefined,
    urlField: "profile.url",
    observedAt: observation.observedAt,
  });

  return {
    businessClaims,
    displayName: name,
    evidence,
    identities,
    location,
    observedAt: observation.observedAt,
    provider: "x",
    sourceIdentity: handleIdentity,
    xHandle: handleIdentity.value,
  };
}

function githubProfileBundle(
  observation: GitHubProfileObservation
): ProfileBundle {
  const handleIdentity =
    normalizeHandle("github", observation.profile.login) ??
    requiredIdentity("github", "handle", observation.profile.login);
  const identities = [handleIdentity];
  const evidence: EntityEvidence[] = [
    makeEvidence({
      confidence: 0.92,
      field: "profile.login",
      kind: "source.identity",
      observedAt: observation.observedAt,
      provider: "github",
      sourceIdentityKey: handleIdentity.key,
      value: handleIdentity.value,
    }),
  ];

  const name = cleanString(observation.profile.name);
  if (name) {
    evidence.push(
      makeEvidence({
        confidence: 0.7,
        field: "profile.name",
        kind: "person.name",
        observedAt: observation.observedAt,
        provider: "github",
        sourceIdentityKey: handleIdentity.key,
        value: name,
      })
    );
  }

  const location = cleanString(observation.profile.location);
  if (location) {
    evidence.push(
      makeEvidence({
        confidence: 0.45,
        field: "profile.location",
        kind: "person.location",
        observedAt: observation.observedAt,
        provider: "github",
        sourceIdentityKey: handleIdentity.key,
        value: location,
      })
    );
  }

  const linkedXHandle = cleanString(observation.profile.twitterUsername);
  const xHandle = linkedXHandle
    ? normalizeHandle("x", linkedXHandle)?.value
    : undefined;

  const businessClaims = buildBusinessClaims({
    companyClaim: companyNameFromGitHubCompany(observation.profile.company),
    provider: "github",
    sourceField: "profile.company",
    sourceIdentity: handleIdentity,
    url: observation.profile.blog ?? undefined,
    urlField: "profile.blog",
    observedAt: observation.observedAt,
  });

  return {
    businessClaims,
    displayName: name,
    evidence,
    identities,
    location,
    observedAt: observation.observedAt,
    provider: "github",
    sourceIdentity: handleIdentity,
    xHandle,
  };
}

function groupProfiles(bundles: ProfileBundle[]): ProfileBundle[][] {
  const xBundles = bundles.filter((bundle) => bundle.provider === "x");
  const githubBundles = bundles.filter(
    (bundle) => bundle.provider === "github"
  );
  const usedXBundles = new Set<ProfileBundle>();
  const groups: ProfileBundle[][] = [];

  for (const githubBundle of githubBundles) {
    const linkedXBundle = githubBundle.xHandle
      ? xBundles.find((bundle) => bundle.xHandle === githubBundle.xHandle)
      : undefined;
    if (linkedXBundle) {
      usedXBundles.add(linkedXBundle);
      groups.push([linkedXBundle, githubBundle]);
    } else {
      groups.push([githubBundle]);
    }
  }

  for (const xBundle of xBundles) {
    if (!usedXBundles.has(xBundle)) {
      groups.push([xBundle]);
    }
  }

  return groups;
}

function resolvePersonGroup(group: ProfileBundle[]): ResolvedPersonCandidate {
  const sourceIdentities = uniqueIdentities(
    group.flatMap((bundle) => bundle.identities)
  );
  const profileEvidence = group.flatMap((bundle) => bundle.evidence);
  const crossLinkEvidence = crossLinkEvidenceForGroup(group);
  const businessClaims = mergeBusinessClaims(
    group.flatMap((bundle) => bundle.businessClaims)
  );
  const currentBusinessClaims = businessClaims.filter(
    (claim) => claim.relationship === "current"
  );
  const conflicting =
    currentBusinessClaims.length > 1 && crossLinkEvidence.length > 0;
  const confidence = crossLinkEvidence.length > 0 ? 0.92 : 0.48;
  const status = resolveEntityStatus({ confidence, conflicting });
  const displayName =
    mostCommonCleanString(group.map((bundle) => bundle.displayName)) ??
    group[0]?.sourceIdentity.value ??
    "Unknown person";
  const evidence = [
    ...profileEvidence,
    ...crossLinkEvidence,
    ...businessClaims.flatMap((claim) => claim.evidence),
  ];
  const affiliations = businessClaims.map((claim) => ({
    businessName: claim.displayName,
    confidence: claim.confidence,
    evidence: claim.evidence,
    relationship: claim.relationship,
    status: resolveEntityStatus({ confidence: claim.confidence }),
  }));

  return {
    affiliations,
    confidence,
    conflicts: conflicting
      ? [
          {
            kind: "business.affiliation",
            values: currentBusinessClaims
              .map((claim) => claim.displayName)
              .sort(),
          },
        ]
      : [],
    displayName,
    evidence: uniqueEvidence(evidence),
    sourceIdentities,
    status,
  };
}

function resolveBusinesses(
  people: ResolvedPersonCandidate[]
): ResolvedBusinessCandidate[] {
  const claims = people.flatMap((person) =>
    person.affiliations.map((affiliation) => ({
      confidence: affiliation.confidence,
      displayName: affiliation.businessName,
      evidence: affiliation.evidence,
      identities: businessIdentitiesFromEvidence(affiliation.evidence),
      relationship: affiliation.relationship,
    }))
  );

  return mergeBusinessClaims(claims)
    .map((claim) => ({
      confidence: claim.confidence,
      displayName: claim.displayName,
      domains: domainsFromIdentities(claim.identities),
      evidence: uniqueEvidence(claim.evidence),
      sourceIdentities: uniqueIdentities(claim.identities),
      status: resolveEntityStatus({ confidence: claim.confidence }),
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function crossLinkEvidenceForGroup(group: ProfileBundle[]): EntityEvidence[] {
  const xBundle = group.find((bundle) => bundle.provider === "x");
  const githubBundle = group.find((bundle) => bundle.provider === "github");
  if (!(xBundle?.xHandle && githubBundle?.xHandle)) {
    return [];
  }
  if (xBundle.xHandle !== githubBundle.xHandle) {
    return [];
  }

  return [
    makeEvidence({
      confidence: 0.95,
      field: "profile.twitterUsername",
      kind: "person.cross_link",
      observedAt: githubBundle.observedAt,
      provider: "github",
      sourceIdentityKey: githubBundle.sourceIdentity.key,
      value: `github:${githubBundle.sourceIdentity.value}->x:${xBundle.xHandle}`,
    }),
  ];
}

function buildBusinessClaims(input: {
  companyClaim?: CompanyNameClaim;
  observedAt?: string;
  provider: "x" | "github";
  sourceField: string;
  sourceIdentity: SourceIdentity;
  url?: string;
  urlField: string;
}): BusinessClaim[] {
  const domainIdentity = input.url
    ? domainIdentityFromUrl(input.url)
    : undefined;
  const companyName = input.companyClaim?.name;
  const relationship = input.companyClaim?.relationship ?? "current";

  if (!(companyName || domainIdentity)) {
    return [];
  }

  const displayName = companyName ?? domainIdentity?.value ?? "Unknown";
  const evidenceItems: EntityEvidence[] = [];
  const identities: SourceIdentity[] = [];

  if (companyName) {
    evidenceItems.push(
      makeEvidence({
        confidence: relationship === "historical" ? 0.36 : 0.66,
        field: input.sourceField,
        kind: "person.affiliation",
        observedAt: input.observedAt,
        provider: input.provider,
        sourceIdentityKey: input.sourceIdentity.key,
        value: companyName,
      }),
      makeEvidence({
        confidence: relationship === "historical" ? 0.36 : 0.58,
        field: input.sourceField,
        kind: "business.name",
        observedAt: input.observedAt,
        provider: input.provider,
        sourceIdentityKey: input.sourceIdentity.key,
        value: companyName,
      })
    );
  }

  if (domainIdentity) {
    identities.push(domainIdentity);
    evidenceItems.push(
      makeEvidence({
        confidence: 0.72,
        field: input.urlField,
        kind: "business.domain",
        observedAt: input.observedAt,
        provider: input.provider,
        sourceIdentityKey: input.sourceIdentity.key,
        value: domainIdentity.value,
      })
    );
  }

  return [
    {
      confidence:
        relationship === "historical"
          ? 0.48
          : companyName && domainIdentity
            ? 0.72
            : 0.48,
      displayName,
      domain: domainIdentity?.value,
      evidence: evidenceItems,
      identities,
      provider: input.provider,
      relationship,
    },
  ];
}

function mergeBusinessClaims(
  claims: Pick<
    BusinessClaim,
    "confidence" | "displayName" | "evidence" | "identities" | "relationship"
  >[]
): BusinessClaim[] {
  const merged: BusinessClaim[] = [];

  for (const claim of claims) {
    const existing = merged.find((candidate) =>
      areSameBusiness(candidate, claim)
    );
    if (existing) {
      existing.confidence = Math.max(
        0.86,
        existing.confidence,
        claim.confidence
      );
      existing.evidence = uniqueEvidence([
        ...existing.evidence,
        ...claim.evidence,
      ]);
      existing.identities = uniqueIdentities([
        ...existing.identities,
        ...claim.identities,
      ]);
      if (claim.relationship === "current") {
        existing.relationship = "current";
      }
      if (existing.displayName.includes(".")) {
        existing.displayName = claim.displayName;
      }
    } else {
      merged.push({
        confidence: claim.confidence,
        displayName: claim.displayName,
        domain: domainsFromIdentities(claim.identities)[0],
        evidence: uniqueEvidence(claim.evidence),
        identities: uniqueIdentities(claim.identities),
        provider: "github",
        relationship: claim.relationship,
      });
    }
  }

  return merged.sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
}

function areSameBusiness(
  left: Pick<BusinessClaim, "displayName" | "identities">,
  right: Pick<BusinessClaim, "displayName" | "identities">
): boolean {
  const leftDomains = domainsFromIdentities(left.identities);
  const rightDomains = domainsFromIdentities(right.identities);
  if (leftDomains.some((domain) => rightDomains.includes(domain))) {
    return true;
  }

  const leftName = normalizeCompanyKey(left.displayName);
  const rightName = normalizeCompanyKey(right.displayName);
  if (leftName && leftName === rightName) {
    return true;
  }

  return (
    leftDomains.some((domain) => rootNameFromDomain(domain) === rightName) ||
    rightDomains.some((domain) => rootNameFromDomain(domain) === leftName)
  );
}

function businessIdentitiesFromEvidence(
  evidenceItems: EntityEvidence[]
): SourceIdentity[] {
  return evidenceItems
    .filter((item) => item.kind === "business.domain")
    .map((item) => ({
      key: sourceIdentityKey({
        provider: "domain",
        type: "domain",
        value: item.value,
      }),
      provider: "domain" as const,
      type: "domain" as const,
      value: item.value.toLowerCase(),
    }));
}

function domainsFromIdentities(identities: SourceIdentity[]): string[] {
  return identities
    .filter((identity) => identity.provider === "domain")
    .map((identity) => identity.value.toLowerCase())
    .filter(unique);
}

function domainIdentityFromUrl(value: string): SourceIdentity | undefined {
  const url = parseUrl(value);
  if (!url) {
    return;
  }
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!domain) {
    return;
  }
  return {
    key: sourceIdentityKey({
      provider: "domain",
      type: "domain",
      value: domain,
    }),
    provider: "domain",
    type: "domain",
    value: domain,
  };
}

function companyNameFromBio(value: string): string | undefined {
  const text = cleanString(value);
  if (!text) {
    return;
  }
  const match = /\b(?:at|@)\s+([A-Z][A-Za-z0-9& .-]*?)(?:[.!?,]|$)/.exec(text);
  return match?.[1] ? cleanCompanyName(match[1]) : undefined;
}

function companyNameFromGitHubCompany(
  value: string | null | undefined
): CompanyNameClaim | undefined {
  const text = cleanString(value);
  if (!text) {
    return;
  }
  const firstCompany = text.split(/[|,]/)[0]?.trim();
  if (!firstCompany) {
    return;
  }
  const relationship = /^ex[-\s]+/i.test(firstCompany)
    ? "historical"
    : "current";
  const name = cleanCompanyName(firstCompany.replace(/^@/, ""));
  return name ? { name, relationship } : undefined;
}

function currentCompanyClaim(
  name: string | undefined
): CompanyNameClaim | undefined {
  return name ? { name, relationship: "current" } : undefined;
}

function cleanCompanyName(value: string): string | undefined {
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^ex[-\s]+/i, "")
    .replace(/[.!,]+$/g, "");
  if (!cleaned) {
    return;
  }
  if (/^[a-z0-9_.-]+$/i.test(cleaned)) {
    return titleizeHandle(cleaned);
  }
  return cleaned;
}

function titleizeHandle(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => {
      const acronym = part.toUpperCase();
      if (["AI", "API", "CRM", "MCP"].includes(acronym)) {
        return acronym;
      }
      return `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`;
    })
    .join(" ");
}

function cleanString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function mostCommonCleanString(
  values: Array<string | undefined>
): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    const cleaned = cleanString(value);
    if (!cleaned) {
      continue;
    }
    counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0];
}

function makeEvidence(input: {
  confidence: number;
  field: string;
  kind: EvidenceKind;
  observedAt?: string;
  provider: "x" | "github";
  sourceIdentityKey?: string;
  value: string;
}): EntityEvidence {
  return {
    confidence: input.confidence,
    id: [
      input.kind,
      input.provider,
      input.field,
      input.value.trim().toLowerCase(),
    ].join(":"),
    kind: input.kind,
    observedAt: input.observedAt,
    source: {
      field: input.field,
      provider: input.provider,
      sourceIdentityKey: input.sourceIdentityKey,
    },
    value: input.value,
  };
}

function requiredIdentity(
  provider: Extract<SourceProvider, "x" | "github">,
  type: SourceIdentityType,
  value: string
): SourceIdentity {
  const normalized = value.trim().toLowerCase();
  return {
    key: sourceIdentityKey({ provider, type, value: normalized }),
    provider,
    type,
    value: normalized,
  };
}

function parseUrl(value: string): URL | undefined {
  try {
    const url = new URL(value.trim());
    if (!(url.protocol === "http:" || url.protocol === "https:")) {
      return;
    }
    return url;
  } catch {
    return;
  }
}

function normalizeCompanyKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function rootNameFromDomain(domain: string): string {
  const parts = domain.toLowerCase().split(".").filter(Boolean);
  return parts.length >= 2 ? (parts.at(-2) ?? "") : (parts[0] ?? "");
}

function uniqueIdentities(identities: SourceIdentity[]): SourceIdentity[] {
  const seen = new Set<string>();
  const result: SourceIdentity[] = [];
  for (const identity of identities) {
    if (seen.has(identity.key)) {
      continue;
    }
    seen.add(identity.key);
    result.push(identity);
  }
  return result;
}

function uniqueEvidence(items: EntityEvidence[]): EntityEvidence[] {
  const seen = new Set<string>();
  const result: EntityEvidence[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function unique<T>(value: T, index: number, values: T[]): boolean {
  return values.indexOf(value) === index;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
