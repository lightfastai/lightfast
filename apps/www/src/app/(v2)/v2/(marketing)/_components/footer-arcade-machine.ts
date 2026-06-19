import { assign, setup } from "xstate";

interface FooterArcadeContext {
  hasFocus: boolean;
  documentVisible: boolean;
}

type FooterArcadeEvent =
  | { type: "START" }
  | { type: "READY" }
  | { type: "BLUR" }
  | { type: "FOCUS" }
  | { type: "DOCUMENT_HIDDEN" }
  | { type: "DOCUMENT_VISIBLE" }
  | { type: "PLAYER_HIT"; livesRemaining: number }
  | { type: "LIFE_LOST_DELAY_DONE" }
  | { type: "GAME_OVER" }
  | { type: "REPLAY" };

export const footerArcadeMachine = setup({
  types: {
    context: {} as FooterArcadeContext,
    events: {} as FooterArcadeEvent,
  },
  guards: {
    canRunAfterFocus: ({ context }) => context.documentVisible,
    canRunAfterVisible: ({ context }) => context.hasFocus,
    hasLivesRemaining: ({ event }) =>
      event.type === "PLAYER_HIT" && event.livesRemaining > 0,
  },
  actions: {
    setFocused: assign({ hasFocus: true }),
    setBlurred: assign({ hasFocus: false }),
    setVisible: assign({ documentVisible: true }),
    setHidden: assign({ documentVisible: false }),
  },
}).createMachine({
  id: "footerArcade",
  initial: "idle",
  context: {
    hasFocus: false,
    documentVisible: true,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "booting",
          actions: "setFocused",
        },
      },
    },
    booting: {
      on: {
        READY: "running",
      },
    },
    running: {
      on: {
        BLUR: {
          target: "paused",
          actions: "setBlurred",
        },
        DOCUMENT_HIDDEN: {
          target: "paused",
          actions: "setHidden",
        },
        PLAYER_HIT: [
          {
            target: "life_lost",
            guard: "hasLivesRemaining",
          },
          {
            target: "game_over",
          },
        ],
        GAME_OVER: "game_over",
      },
    },
    paused: {
      on: {
        FOCUS: [
          {
            target: "running",
            guard: "canRunAfterFocus",
            actions: "setFocused",
          },
          {
            actions: "setFocused",
          },
        ],
        DOCUMENT_VISIBLE: [
          {
            target: "running",
            guard: "canRunAfterVisible",
            actions: "setVisible",
          },
          {
            actions: "setVisible",
          },
        ],
        DOCUMENT_HIDDEN: {
          actions: "setHidden",
        },
        BLUR: {
          actions: "setBlurred",
        },
      },
    },
    life_lost: {
      on: {
        LIFE_LOST_DELAY_DONE: "running",
        GAME_OVER: "game_over",
      },
    },
    game_over: {
      on: {
        REPLAY: {
          target: "booting",
          actions: "setFocused",
        },
      },
    },
  },
});
