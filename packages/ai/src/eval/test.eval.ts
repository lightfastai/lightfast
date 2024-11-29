import { Levenshtein } from "autoevals";
import { Eval } from "braintrust";

Eval(
  "Say Hi Bot", // Replace with your project name
  {
    data: () => {
      return [
        {
          input: "Foo",
          expected: "Hi Foo",
        },
        {
          input: "Bar",
          expected: "Hello Bar",
        },
      ]; // Replace with your eval dataset
    },
    task: async (input) => {
      if (input === "Bar") {
        return "Hello Bar";
      }
      return "Hi " + input; // Replace with your LLM call
    },
    scores: [Levenshtein],
  },
);
