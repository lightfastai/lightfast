import type { z } from "zod";
import type { PostTransformEvent } from "../contracts/event";
import type { ActionDef } from "./kinds";
import type { TransformContext } from "./primitives";

/** Simple event — no sub-actions */
export interface SimpleEventDef<S extends z.ZodType = z.ZodType> {
  readonly kind: "simple";
  readonly label: string;
  readonly schema: S;
  readonly transform: (
    payload: z.infer<S>,
    ctx: TransformContext,
    eventType: string
  ) => PostTransformEvent;
  readonly weight: number;
}

/** Event with sub-actions (e.g., PR opened/closed/merged) */
export interface ActionEventDef<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> {
  readonly actions: TActions;
  readonly kind: "with-actions";
  readonly label: string;
  readonly schema: S;
  readonly transform: (
    payload: z.infer<S>,
    ctx: TransformContext,
    eventType: string
  ) => PostTransformEvent;
  readonly weight: number;
}

/** Discriminated union — switches on `kind` */
export type EventDefinition<
  S extends z.ZodType = z.ZodType,
  TActions extends Record<string, ActionDef> = Record<string, ActionDef>,
> = SimpleEventDef<S> | ActionEventDef<S, TActions>;

/** Factory: simple event (no sub-actions) */
export function simpleEvent<S extends z.ZodType>(
  def: Omit<SimpleEventDef<S>, "kind">
): SimpleEventDef<S> {
  return { kind: "simple", ...def };
}

/** Factory: event with sub-actions */
export function actionEvent<
  S extends z.ZodType,
  const TActions extends Record<string, ActionDef>,
>(def: Omit<ActionEventDef<S, TActions>, "kind">): ActionEventDef<S, TActions> {
  return { kind: "with-actions", ...def };
}
