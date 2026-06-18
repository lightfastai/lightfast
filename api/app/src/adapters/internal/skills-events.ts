import { handleSkillIndexEventsRequest as handleSkillIndexEventsServiceRequest } from "../../services/skills/events";

export async function handleSkillIndexEventsRequest(
  request: Request
): Promise<Response> {
  return handleSkillIndexEventsServiceRequest(request);
}
