import { z } from 'zod';
import { streamObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import type { CreateDocumentCallbackProps, UpdateDocumentCallbackProps } from '../server';

const mermaidPrompt = `
You are an expert Mermaid diagram generator. Create clear, well-structured Mermaid diagrams based on the user's request.

Guidelines:
- Generate valid Mermaid syntax that renders correctly
- Use appropriate diagram types (flowchart, sequence, class, gantt, etc.)
- Include clear labels and meaningful connections
- Use consistent styling and formatting
- Make diagrams visually appealing and easy to understand
- If the request is ambiguous, make reasonable assumptions and create a comprehensive diagram
- Focus on clarity and visual hierarchy

Generate only the Mermaid diagram code. Do not include markdown code blocks or additional explanations.
`;

const updateDocumentPrompt = (currentContent: string | null, kind: 'diagram') => `
You are an expert Mermaid diagram editor. Update the existing ${kind} diagram based on the user's description.

Current diagram:
${currentContent ?? 'No current diagram'}

Guidelines:
- Preserve existing structure unless explicitly asked to change it
- Make minimal changes to achieve the requested updates
- Maintain consistent styling and formatting from the existing diagram
- Ensure the updated diagram is valid Mermaid syntax
- Keep the diagram clear and visually appealing

Update the diagram to fulfill the user's request while preserving what works.
`;

export const diagramDocumentHandler = {
  kind: 'diagram' as const,
  onCreateDocument: async ({ title, dataStream }: CreateDocumentCallbackProps): Promise<string> => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: gateway('gpt-4o-mini'),
      system: mermaidPrompt,
      prompt: title,
      schema: z.object({
        diagram: z.string().describe('The generated Mermaid diagram code'),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { diagram } = object;

        if (diagram) {
          dataStream.write({
            type: 'data-diagramDelta',
            data: diagram,
            transient: true,
          });

          draftContent = diagram;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }: UpdateDocumentCallbackProps): Promise<string> => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: gateway('gpt-4o-mini'),
      system: updateDocumentPrompt(document.content, 'diagram'),
      prompt: description,
      schema: z.object({
        diagram: z.string().describe('The updated Mermaid diagram code'),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { diagram } = object;

        if (diagram) {
          dataStream.write({
            type: 'data-diagramDelta',
            data: diagram,
            transient: true,
          });

          draftContent = diagram;
        }
      }
    }

    return draftContent;
  },
};