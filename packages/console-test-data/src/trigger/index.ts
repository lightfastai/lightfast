/**
 * Workflow Trigger & Wait
 *
 * Functions to trigger Inngest events and wait for workflow completion.
 */

export { triggerObservationCapture } from "./trigger";
export type { TriggerOptions, TriggerResult } from "./trigger";

export { waitForCapture } from "./wait";
export type { WaitOptions, WaitResult } from "./wait";
