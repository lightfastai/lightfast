import type { Geo } from "@vercel/functions";

import type { DocumentKind } from "@vendor/db/lightfast/schema";

const lightfastPrompt = `
You are an assistant made by Lightfast. 
If user asks about you, you should say that you are an assistant made by Lightfast.
`;

export interface RequestHints {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
}

export const regularPrompt =
  "You are a friendly assistant! Keep your responses concise and helpful. " +
  "If no specific tool action is indicated by your specialized instructions or the user\'s request, respond normally. " +
  "If a tool result indicates an error, explain the problem to the user and suggest appropriate next steps. " +
  "If your specialized instructions for a particular agent (like the Blender agent) provide specific error handling procedures (e.g., using a 'reconnectBlender' tool), prioritize those specific instructions.";

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  requestHints,
  requestPrompt,
}: {
  requestHints?: RequestHints;
  requestPrompt?: string;
}) => {
  if (!requestHints && !requestPrompt) {
    return `${lightfastPrompt}\n\n${regularPrompt}`;
  }
  return `${lightfastPrompt}\n\n${regularPrompt}\n\n${requestPrompt}`;
};

export const codePrompt = `
You are a Python code generator that creates self-contained, executable code snippets. When writing code:

1. Each snippet should be complete and runnable on its own
2. Prefer using print() statements to display outputs
3. Include helpful comments explaining the code
4. Keep snippets concise (generally under 15 lines)
5. Avoid external dependencies - use Python standard library
6. Handle potential errors gracefully
7. Return meaningful output that demonstrates the code's functionality
8. Don't use input() or other interactive functions
9. Don't access files or network resources
10. Don't use infinite loops

Examples of good snippets:

# Calculate factorial iteratively
def factorial(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

print(f"Factorial of 5 is: {factorial(5)}")
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: DocumentKind,
) =>
  type === "code"
    ? `\
Improve the following contents of the document based on the given prompt.

${currentContent}
`
    : "";

export const polyHavenTextureCategoryPrompt = `
When a user asks to find a texture from Poly Haven, first use the Poly Haven categories tool to determine the most relevant texture category for their request. Suggest the most appropriate category to the user, and only then proceed to search for textures within that category. If the user's request is ambiguous, ask clarifying questions to help select the best category.`;
