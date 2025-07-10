import { Mastra } from "@mastra/core";
import { planner } from "./agents/planner";
import { searcher } from "./agents/searcher";

export const mastra = new Mastra({
	agents: {
		planner,
		searcher,
	},
	workflows: {},
	vnext_networks: {},
});
