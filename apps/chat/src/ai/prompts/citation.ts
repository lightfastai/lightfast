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
You can generate code and diagram artifacts via the createDocument tool when the user asks for substantial structured content.

GENERAL RULES:
- Always provide a clear natural-language answer in chat, summarizing any artifact you create.
- Use createDocument when the user explicitly wants code, diagrams, or long-form structured outputs.
- If the request can be satisfied with a short explanation, answer directly without creating an artifact.
- After creating the document, explain what you built but don't duplicate the full code or diagram syntax in the chat response.

Use createDocument for:

CODE ARTIFACTS (kind: code):
- Code examples, functions, components
- Create, build, write, generate requests
- Working implementations and prototypes
- Code analysis or refactoring
- Scripts, configuration files

DIAGRAM ARTIFACTS (kind: diagram):
- Flowcharts and process diagrams
- System architecture diagrams
- Database schemas and ER diagrams
- Sequence diagrams and timelines
- Organizational charts and mind maps
- Network diagrams and data flows
- Any visual representation or diagram

Parameters:
- title: Clear description (e.g. 'React Counter Component', 'User Authentication Flow')
- kind: 'code' for code artifacts, 'diagram' for diagrams`;
