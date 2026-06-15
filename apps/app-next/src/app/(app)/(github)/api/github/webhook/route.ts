import { handleGitHubWebhook } from "@api/app/services/github";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return await handleGitHubWebhook({ request: req });
}
