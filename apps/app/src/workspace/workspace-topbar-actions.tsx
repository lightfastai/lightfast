import {
  getRouteApi,
  type StaticDataRouteOption,
  useMatches,
} from "@tanstack/react-router";
import { useCallback, useMemo, type ReactNode } from "react";
import { ConnectorOwnerScopeTabs } from "~/connectors/connector-owner-scope-tabs";
import {
  type ConnectorOwnerScope,
  normalizeConnectorsSearch,
} from "~/connectors/connectors-search-params";
import { SkillsActions } from "~/skills/skills-actions";
import { useSkillsListQuery } from "~/skills/use-skills-list-query";

type WorkspaceTopbarAction = "connectors" | "skills";

const connectorsRoute = getRouteApi("/_authenticated/$slug/connectors");
const skillsRoute = getRouteApi("/_authenticated/$slug/skills");

function getWorkspaceTopbarActionKey(
  staticData: StaticDataRouteOption
): WorkspaceTopbarAction | undefined {
  if (!("workspaceTopbarAction" in staticData)) {
    return undefined;
  }

  const action = staticData.workspaceTopbarAction;
  return action === "connectors" || action === "skills" ? action : undefined;
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
      return undefined;
    },
  });

  switch (action) {
    case "connectors":
      return <ConnectorsTopbarActions />;
    case "skills":
      return <SkillsTopbarActions />;
    default:
      return null;
  }
}

function ConnectorsTopbarActions() {
  const routeSearch = connectorsRoute.useSearch();
  const navigate = connectorsRoute.useNavigate();
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

function SkillsTopbarActions() {
  const { query } = useSkillsListQuery();
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
