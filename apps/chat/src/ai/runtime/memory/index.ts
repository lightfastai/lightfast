import { MessagesService } from "@repo/chat-api-services/messages";
import { SessionsService } from "@repo/chat-api-services/sessions";
import { StreamsService } from "@repo/chat-api-services/streams";

import { PlanetScaleMemory } from "./planetscale";

/**
 * Factory function to create a PlanetScale memory instance with service dependencies
 */
export function createPlanetScaleMemory(): PlanetScaleMemory {
  const messagesService = new MessagesService();
  const sessionsService = new SessionsService();
  const streamsService = new StreamsService();

  return new PlanetScaleMemory(
    messagesService,
    sessionsService,
    streamsService,
  );
}

export { PlanetScaleMemory } from "./planetscale";
export { AnonymousRedisMemory } from "./redis";
