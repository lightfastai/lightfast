import { z } from 'zod';
import { streamObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createDocumentHandler } from '../server';

const codePrompt = `
You are an expert code generator. Generate clean, well-documented, and functional code based on the user's request.

Guidelines:
- Write production-ready code with proper error handling
- Include helpful comments and documentation
- Use modern best practices for the language
- Ensure code is complete and runnable
- If the request is ambiguous, make reasonable assumptions and document them
- Focus on readability and maintainability

Generate code that directly fulfills the user's request. Do not include additional explanations outside the code.
`;

const updateDocumentPrompt = (currentContent: string | null, kind: 'code') => `
You are an expert code editor. Update the existing ${kind} based on the user's description.

Current content:
${currentContent || 'No current content'}

Guidelines:
- Preserve existing functionality unless explicitly asked to change it
- Make minimal changes to achieve the requested updates
- Maintain code style and patterns from the existing code
- Add proper comments for new functionality
- Ensure the updated code is complete and runnable

Update the code to fulfill the user's request while preserving what works.
`;

export const codeDocumentHandler = createDocumentHandler<'code'>({
  kind: 'code',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: gateway('gpt-4o-mini'),
      system: codePrompt,
      prompt: title,
      schema: z.object({
        code: z.string().describe('The generated code'),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: 'data-codeDelta',
            data: code ?? '',
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamObject({
      model: gateway('gpt-4o-mini'),
      system: updateDocumentPrompt(document.content, 'code'),
      prompt: description,
      schema: z.object({
        code: z.string().describe('The updated code'),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: 'data-codeDelta',
            data: code ?? '',
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});