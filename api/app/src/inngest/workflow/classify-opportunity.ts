import { db } from "@db/app/client";

import { processOpportunityClassification } from "../../opportunities/processor";
import { inngest } from "../client";

export const classifyOpportunity = inngest.createFunction(
  { id: "classify-opportunity" },
  { event: "app/opportunity.created" },
  async ({ event, step }) =>
    step.run("classify opportunity", () =>
      processOpportunityClassification({
        db,
        opportunityId: event.data.opportunityId,
        clerkOrgId: event.data.clerkOrgId,
      })
    )
);
