/**
 * Citation prompt components
 *
 * Centralized citation format definition used across evaluation and production
 */

export const CITATION_FORMAT_SECTION = `CITATION USAGE:
When referencing external information, use numbered citations in your response and provide structured citation data.

Format: Use [1], [2], [3] etc. in your text, then end your complete response with metadata.

Example response format:
React 19 introduces server components [1] which work seamlessly with Next.js [2]. This approach simplifies state management [3].

---METADATA---
{
  "citations": [
    {"id": 1, "url": "https://react.dev/blog/react-19", "title": "React 19 Release", "snippet": "Introducing server components for better performance"},
    {"id": 2, "url": "https://nextjs.org/docs/app-router", "title": "Next.js App Router", "snippet": "Complete guide to the new routing system"},
    {"id": 3, "url": "https://docs.example.com/state", "title": "State Management Guide"}
  ]
}

Rules:
- Use numbered citations [1], [2], [3] in your response text
- Always end with ---METADATA--- followed by JSON data
- Include sequential IDs starting from 1
- Provide URLs and titles (snippets are optional)
- Only cite facts, statistics, API details, version numbers, quotes
- Don't cite common knowledge or your own analysis
- When the user requests sources, include at least 2 citations whenever possible`;

export const CODE_FORMATTING_SECTION = `CODE FORMATTING:
When providing code snippets in your responses, always use proper markdown code blocks with language specification:

\`\`\`rust
fn main() {
    println!("Hello, world!");
}
\`\`\`

\`\`\`javascript
console.log("Hello, world!");
\`\`\`

\`\`\`python
print("Hello, world!")
\`\`\`

Use the appropriate language identifier (rust, javascript, python, typescript, etc.) for syntax highlighting.`;

export const ARTIFACT_INSTRUCTIONS_SECTION = `ARTIFACT CAPABILITIES:
You can generate artifacts via the createDocument tool when that best matches the user’s intent.

PRINCIPLES:
- Prefer chat responses by default. Use createDocument only when the user explicitly requests a standalone artifact (e.g., code snippet, component, script, or diagram) or when the output is clearly better as a separate document.
- Do not produce code or code artifacts for non-code content. Avoid wrapping plain text in code fences or JSON.
- Always summarize the artifact in chat after creation; do not paste the full artifact in the chat message.
- If unsure whether to create an artifact, ask one brief clarifying question. Otherwise, default to answering in chat.

KIND SELECTION:
- kind: 'code' only for actual source code or configuration meant to be executed, compiled, or copied into files.
- kind: 'diagram' only for structural or visual representations where diagram syntax is appropriate.

PARAMETERS:
- title: concise, descriptive label for the artifact (3–6 words recommended).
- kind: 'code' or 'diagram' as defined above.`;
