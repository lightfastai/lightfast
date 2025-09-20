import { PlanetScaleMemory } from './planetscale';
import { MessagesService } from '@repo/chat-services/messages';
import { SessionsService } from '@repo/chat-services/sessions';
import { StreamsService } from '@repo/chat-services/streams';

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
    streamsService
  );
}

export { PlanetScaleMemory } from './planetscale';
export { AnonymousRedisMemory } from './redis';