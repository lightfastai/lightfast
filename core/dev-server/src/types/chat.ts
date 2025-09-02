// Chat-related type definitions for the dev-server
import type { UIMessage } from 'ai';

/**
 * Custom metadata for dev-server messages
 */
export interface DevServerMessageMetadata {
  createdAt?: string;
  sessionId?: string;
  agentId?: string;
  timestamp?: number;
}

/**
 * Custom data types for message parts (empty for now, can be extended)
 */
export type DevServerCustomDataTypes = Record<string, unknown>;

/**
 * Tool set for the dev server (empty for now, agents define their own tools)
 */
export type DevServerToolSet = Record<string, never>;

/**
 * Main UIMessage type with our custom generics
 */
export type DevServerUIMessage = UIMessage<
  DevServerMessageMetadata,
  DevServerCustomDataTypes,
  DevServerToolSet
>;

/**
 * Helper type for message parts
 */
export type DevServerUIMessagePart = DevServerUIMessage["parts"][number];

/**
 * Lightfast message format (used in the API)
 */
export interface LightfastMessage {
  role: 'user' | 'assistant' | 'system';
  parts: Array<{
    type: 'text';
    text: string;
  }>;
  id: string;
}

/**
 * Conversion helper from Lightfast format to UI format
 */
export function lightfastToUIMessage(message: LightfastMessage): DevServerUIMessage {
  return {
    role: message.role,
    id: message.id,
    parts: message.parts.map(part => ({
      type: part.type,
      text: part.text,
    })),
  };
}

/**
 * Conversion helper from UI format to Lightfast format
 */
export function uiToLightfastMessage(message: DevServerUIMessage): LightfastMessage {
  return {
    role: message.role,
    id: message.id,
    parts: message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => ({
        type: 'text',
        text: part.text,
      })),
  };
}