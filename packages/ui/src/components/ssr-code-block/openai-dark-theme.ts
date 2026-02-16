import type { ThemeRegistrationRaw } from "shiki";

/**
 * Custom Shiki theme matching OpenAI's developer docs dark mode.
 * Colors extracted from https://developers.openai.com/docs
 */
export const openaiDark: ThemeRegistrationRaw = {
  name: "openai-dark",
  type: "dark",
  colors: {
    "editor.background": "#000000",
    "editor.foreground": "#dcdcdc",
    "editorLineNumber.foreground": "#5d5d5d",
  },
  settings: [
    {
      settings: {
        foreground: "#dcdcdc",
      },
    },
    // Keywords: import, from, const, new, await, return, if, else, etc.
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "storage.type",
        "storage.modifier",
        "variable.language.this",
        "constant.language",
      ],
      settings: {
        foreground: "#2e95d3",
      },
    },
    // Quoted strings only — green
    {
      scope: [
        "string.quoted",
        "string.template",
      ],
      settings: {
        foreground: "#00a67d",
      },
    },
    // Unquoted strings (bare args like `lightfast` in shell) — plain white
    {
      scope: [
        "string.unquoted",
      ],
      settings: {
        foreground: "#dcdcdc",
      },
    },
    // Object keys (model:, input:) — pink
    {
      scope: [
        "meta.object-literal.key",
        "support.type.property-name",
      ],
      settings: {
        foreground: "#df3079",
      },
    },
    // Properties and methods (.log, .create, .responses) — plain white
    {
      scope: [
        "variable.other.property",
        "variable.other.object.property",
        "entity.name.function",
        "meta.function-call",
        "support.function",
      ],
      settings: {
        foreground: "#dcdcdc",
      },
    },
    // Variables and parameters — plain white
    {
      scope: [
        "variable.other.readwrite",
        "variable.parameter",
        "variable.other.constant",
      ],
      settings: {
        foreground: "#dcdcdc",
      },
    },
    // Built-in objects (console) — orange
    {
      scope: [
        "support.variable",
        "support.class",
      ],
      settings: {
        foreground: "#e9950c",
      },
    },
    // Tags (HTML/JSX) — pink
    {
      scope: ["entity.name.tag"],
      settings: {
        foreground: "#df3079",
      },
    },
    // Numbers
    {
      scope: ["constant.numeric"],
      settings: {
        foreground: "#df3079",
      },
    },
    // Comments
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: {
        foreground: "#5d5d5d",
      },
    },
    // Operators
    {
      scope: [
        "keyword.operator",
        "keyword.operator.assignment",
        "keyword.operator.arithmetic",
        "keyword.operator.comparison",
        "keyword.operator.logical",
      ],
      settings: {
        foreground: "#dcdcdc",
      },
    },
    // Punctuation
    {
      scope: [
        "punctuation",
        "meta.brace",
        "meta.delimiter",
      ],
      settings: {
        foreground: "#dcdcdc",
      },
    },
    // Types, interfaces, class names (OpenAI) — green
    {
      scope: [
        "entity.name.type",
        "support.type",
        "entity.name.class",
        "new.expr entity.name.type",
      ],
      settings: {
        foreground: "#00a67d",
      },
    },
    // Decorators / annotations
    {
      scope: ["meta.decorator", "punctuation.decorator"],
      settings: {
        foreground: "#e9950c",
      },
    },
    // Template expression punctuation
    {
      scope: ["punctuation.definition.template-expression"],
      settings: {
        foreground: "#2e95d3",
      },
    },
  ],
};
