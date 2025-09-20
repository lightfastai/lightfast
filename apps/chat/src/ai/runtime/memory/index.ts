import { PlanetScaleMemory } from './planetscale';
import { MessagesService } from '~/services/messages.service';
import { SessionsService } from '~/services/sessions.service';
import { StreamsService } from '~/services/streams.service';

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