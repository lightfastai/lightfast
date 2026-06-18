import { useQuery } from "@tanstack/react-query";
import {
  getRouteApi,
  type StaticDataRouteOption,
  useMatches,
} from "@tanstack/react-router";
import { type ReactNode, useCallback, useMemo } from "react";
import { ConnectorOwnerScopeTabs } from "~/connectors/connector-owner-scope-tabs";
import {
  type ConnectorOwnerScope,
  normalizeConnectorsSearch,
} from "~/connectors/connectors-search-params";
import {
  type NormalizedPeopleSearch,
  normalizePeopleSearch,
} from "~/people/people-search-params";
import { PeopleViewSwitcher } from "~/people/people-view-switcher";
import {
  type NormalizedSignalsSearch,
  normalizeSignalsSearch,
} from "~/signals/signals-search-params";
import { SignalsViewSwitcher } from "~/signals/signals-view-switcher";
import { SkillsActions } from "~/skills/skills-actions";
import { skillsListQueryOptions } from "~/skills/skills-queries";

type WorkspaceTopbarAction = "connectors" | "people" | "signals" | "skills";

const workspaceActionRoutes = {
  connectors: getRouteApi("/_authenticated/$slug/connectors"),
  people: getRouteApi("/_authenticated/$slug/people"),
  skills: getRouteApi("/_authenticated/$slug/skills"),
  signals: getRouteApi("/_authenticated/$slug/signals"),
};

function getWorkspaceTopbarActionKey(
  staticData: StaticDataRouteOption
): WorkspaceTopbarAction | undefined {
  if (!("workspaceTopbarAction" in staticData)) {
    return;
  }

  const action = staticData.workspaceTopbarAction;
  if (
    action === "connectors" ||
    action === "people" ||
    action === "signals" ||
    action === "skills"
  ) {
    return action;
  }

  return;
}

export function useWorkspaceTopbarAction(): ReactNode {
  const action = useMatches({
    select: (matches) => {
      for (let index = matches.length - 1; index >= 0; index -= 1) {
        const match = matches[index];
        if (match) {
          const action = getWorkspaceTopbarActionKey(match.staticData);
          if (action) {
            return action;
          }
        }
      }
      return;
    },
  });

  switch (action) {
    case "connectors":
      return <ConnectorsTopbarActions />;
    case "people":
      return <PeopleTopbarActions />;
    case "signals":
      return <SignalsTopbarActions />;
    case "skills":
      return <SkillsTopbarActions />;
    default:
      return null;
  }
}

function ConnectorsTopbarActions() {
  const routeSearch = workspaceActionRoutes.connectors.useSearch();
  const navigate = workspaceActionRoutes.connectors.useNavigate();
  const search = useMemo(
    () => normalizeConnectorsSearch(routeSearch),
    [routeSearch]
  );
  const setOwnerScope = useCallback(
    (scope: ConnectorOwnerScope) => {
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          scope: scope === "team" ? undefined : scope,
        }),
      });
    },
    [navigate]
  );

  return (
    <ConnectorOwnerScopeTabs
      onOwnerScopeChange={setOwnerScope}
      ownerScope={search.scope}
    />
  );
}

function PeopleTopbarActions() {
  const routeSearch = workspaceActionRoutes.people.useSearch();
  const navigate = workspaceActionRoutes.people.useNavigate();
  const search = useMemo(
    () => normalizePeopleSearch(routeSearch),
    [routeSearch]
  );
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedPeopleSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("peopleQuery" in updates) {
            next.peopleQuery = updates.peopleQuery || undefined;
          }
          if ("provider" in updates) {
            next.provider = updates.provider || undefined;
          }
          if ("type" in updates) {
            next.type = updates.type || undefined;
          }
          if ("person" in updates) {
            next.person = updates.person || undefined;
          }
          if ("view" in updates) {
            next.view = updates.view || undefined;
          }
          return next;
        },
      });
    },
    [navigate]
  );

  return (
    <PeopleViewSwitcher search={search} setSearchParams={setSearchParams} />
  );
}

function SkillsTopbarActions() {
  const query = useQuery(skillsListQueryOptions());
  const data = query.data;

  if (!data) {
    return null;
  }

  return (
    <SkillsActions
      freshness={data.freshness}
      repositoryUrl={data.repositoryUrl}
    />
  );
}

function SignalsTopbarActions() {
  const routeSearch = workspaceActionRoutes.signals.useSearch();
  const navigate = workspaceActionRoutes.signals.useNavigate();
  const search = useMemo(
    () => normalizeSignalsSearch(routeSearch),
    [routeSearch]
  );
  const setSearchParams = useCallback(
    (updates: Partial<NormalizedSignalsSearch>) => {
      void navigate({
        replace: true,
        search: (previous) => {
          const next = { ...previous };
          if ("disposition" in updates) {
            next.disposition = updates.disposition || undefined;
          }
          if ("kind" in updates) {
            next.kind = updates.kind || undefined;
          }
          if ("people" in updates) {
            next.people =
              updates.people === "routed" ? updates.people : undefined;
          }
          if ("priority" in updates) {
            next.priority = updates.priority || undefined;
          }
          if ("signal" in updates) {
            next.signal = updates.signal || undefined;
          }
          if ("view" in updates) {
            next.view = updates.view || undefined;
          }
          return next;
        },
      });
    },
    [navigate]
  );

  return (
    <SignalsViewSwitcher search={search} setSearchParams={setSearchParams} />
  );
}
