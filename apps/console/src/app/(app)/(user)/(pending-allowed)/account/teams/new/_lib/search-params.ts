import { createLoader, createSerializer, parseAsString } from "nuqs/server";

export const teamSearchParams = {
  error: parseAsString,
};

export const loadTeamSearchParams = createLoader(teamSearchParams);
export const serializeTeamParams = createSerializer(teamSearchParams);
