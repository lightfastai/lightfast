/**
 * Citation prompt components
 * 
 * Centralized citation format definition used across evaluation and production
 */

export const CITATION_FORMAT_SECTION = `CITATION USAGE:
When referencing external information, use numbered citations in your response and provide structured citation data.

Format: Use [1], [2], [3] etc. in your text, then end your complete response with citation data.

Example response format:
React 19 introduces server components [1] which work seamlessly with Next.js [2]. This approach simplifies state management [3].

---CITATIONS---
{
  "citations": [
    {"id": 1, "url": "https://react.dev/blog/react-19", "title": "React 19 Release", "snippet": "Introducing server components for better performance"},
    {"id": 2, "url": "https://nextjs.org/docs/app-router", "title": "Next.js App Router", "snippet": "Complete guide to the new routing system"},
    {"id": 3, "url": "https://docs.example.com/state", "title": "State Management Guide"}
  ]
}

Rules:
- Use numbered citations [1], [2], [3] in your response text
- Always end with ---CITATIONS--- followed by JSON data
- Include sequential IDs starting from 1
- Provide URLs and titles (snippets are optional)
- Only cite facts, statistics, API details, version numbers, quotes
- Don't cite common knowledge or your own analysis`;

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

export const ARTIFACT_INSTRUCTIONS_SECTION = `IMPORTANT: When users request code generation, examples, substantial code snippets, or diagrams, ALWAYS use the createDocument tool. Do NOT include the code or diagram syntax in your text response - they should ONLY exist in the document artifact.

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
- kind: 'code' for code artifacts, 'diagram' for diagrams

After creating the document, explain what you built but don't duplicate the code or diagram syntax in your response.`;