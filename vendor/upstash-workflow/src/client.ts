import { Client } from "@upstash/workflow";
import { env } from "../env";

export const workflowClient = new Client({ token: env.QSTASH_TOKEN });
