/**
 * SSE Stream Parser Utilities
 * Parses Server-Sent Events from the Deus API
 */

import type {
  LightfastAppDeusUIMessage,
  LightfastAppDeusUIMessagePart,
  RunCodingToolInput,
  RunCodingToolOutput,
} from '@repo/deus-types';

/**
 * Stream event types from Vercel AI SDK
 */
export type StreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'text-start'; id: string }
  | { type: 'text-end'; id: string }
  | {
      type: 'tool-input-start';
      toolCallId: string;
      toolName: string;
    }
  | {
      type: 'tool-input-delta';
      toolCallId: string;
      toolName: string;
      delta: string;
    }
  | {
      type: 'tool-input-available';
      toolCallId: string;
      toolName: string;
      input: RunCodingToolInput;
    }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      result: RunCodingToolOutput;
    }
  | { type: 'error'; errorText: string }
  | { type: 'finish'; finishReason?: string; usage?: any };

/**
 * Parse SSE data line
 * @param line Raw SSE line (e.g., "data: {...}")
 * @returns Parsed stream event or null
 */
export function parseStreamLine(line: string): StreamEvent | null {
  // Remove "data: " prefix
  if (!line.startsWith('data:')) {
    return null;
  }

  const jsonStr = line.slice(5).trim();

  // Handle stream end marker
  if (jsonStr === '[DONE]') {
    return { type: 'finish' };
  }

  // Parse JSON
  try {
    const data = JSON.parse(jsonStr);
    return data as StreamEvent;
  } catch (error) {
    console.error('[StreamParser] Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Message accumulator for building UIMessage from stream events
 */
export class MessageAccumulator {
  private textBuffer: string = '';
  private parts: LightfastAppDeusUIMessagePart[] = [];
  private toolCalls: Map<string, Partial<RunCodingToolInput>> = new Map();
  private toolResults: Map<string, RunCodingToolOutput> = new Map();

  /**
   * Process a stream event and update the accumulator
   */
  processEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'text-delta':
        this.textBuffer += event.delta;
        break;

      case 'text-end':
        // Finalize text part
        if (this.textBuffer.trim()) {
          this.parts.push({
            type: 'text',
            text: this.textBuffer,
          });
          this.textBuffer = '';
        }
        break;

      case 'tool-input-start':
        // Initialize tool call tracking
        this.toolCalls.set(event.toolCallId, {});
        break;

      case 'tool-input-delta':
        // Accumulate tool input (not used for now, but available for streaming UI)
        break;

      case 'tool-input-available':
        // Tool input is complete
        if (event.toolName === 'run_coding_tool') {
          this.parts.push({
            type: 'tool-run_coding_tool',
            toolCallId: event.toolCallId,
            state: 'input-available',
            input: event.input,
          });
        }
        break;

      case 'tool-result':
        // Tool execution completed
        if (event.toolName === 'run_coding_tool') {
          // Find the tool call part and update it with the result
          const toolPartIndex = this.parts.findIndex(
            (p) => 'toolCallId' in p && p.toolCallId === event.toolCallId
          );

          if (toolPartIndex !== -1) {
            const toolPart = this.parts[toolPartIndex];
            if (toolPart && 'toolCallId' in toolPart && 'input' in toolPart && toolPart.input) {
              // Update the existing tool part to output-available state
              this.parts[toolPartIndex] = {
                type: 'tool-run_coding_tool',
                toolCallId: event.toolCallId,
                state: 'output-available',
                input: toolPart.input as RunCodingToolInput,
                output: event.result,
              };
            }
          }
        }
        break;

      case 'error':
        // Add error as text part
        this.parts.push({
          type: 'text',
          text: `Error: ${event.errorText}`,
        });
        break;

      case 'finish':
        // Stream finished - finalize any remaining text
        if (this.textBuffer.trim()) {
          this.parts.push({
            type: 'text',
            text: this.textBuffer,
          });
          this.textBuffer = '';
        }
        break;
    }
  }

  /**
   * Get the current accumulated text (for real-time display)
   */
  getCurrentText(): string {
    return this.textBuffer;
  }

  /**
   * Get all accumulated parts
   */
  getParts(): LightfastAppDeusUIMessagePart[] {
    return this.parts;
  }

  /**
   * Check if there's any content
   */
  hasContent(): boolean {
    return this.parts.length > 0 || this.textBuffer.trim().length > 0;
  }

  /**
   * Reset the accumulator
   */
  reset(): void {
    this.textBuffer = '';
    this.parts = [];
    this.toolCalls.clear();
    this.toolResults.clear();
  }
}

/**
 * Parse SSE stream and accumulate messages
 * @param chunk Raw chunk from stream
 * @returns Array of parsed events
 */
export function parseStreamChunk(chunk: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  const lines = chunk.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const event = parseStreamLine(line);
    if (event) {
      events.push(event);
    }
  }

  return events;
}
