import { handleGitHubWebhook as handleGitHubWebhookServiceRequest } from "../../services/github";

export async function handleGitHubWebhookRequest(
  request: Request
): Promise<Response> {
  return handleGitHubWebhookServiceRequest({ request });
}
