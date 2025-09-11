import { Artifact } from './create-artifact';
import { Response } from '@repo/ui/components/ai-elements/response';
import {
  CopyIcon,
  MessageIcon,
} from './icons';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Metadata {
  // Empty for now - can be extended later for diagram metadata
}

export const mermaidArtifact = new Artifact<'mermaid', Metadata>({
  kind: 'mermaid',
  description: 'Useful for creating diagrams, flowcharts, and visual representations.',
  initialize: ({ setMetadata }) => {
    setMetadata({});
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if ((streamPart as { type: string }).type === 'data-mermaidDelta') {
      setArtifact((draftArtifact) => {
        const newContent = draftArtifact.content + (streamPart as { data: string }).data;
        return {
          ...draftArtifact,
          content: newContent,
          isVisible:
            draftArtifact.status === 'streaming' &&
            newContent.length > 50 &&
            newContent.length < 60
              ? true
              : draftArtifact.isVisible,
          status: 'streaming',
        };
      });
    }
  },
  content: ({ metadata: _metadata, setMetadata: _setMetadata, content, ...props }) => {
    // Format content as markdown code block for Streamdown to render
    const mermaidContent = `\`\`\`mermaid\n${content}\n\`\`\``;
    
    return (
      <div className="px-1">
        <div className="border rounded-lg bg-background/50 overflow-hidden">
          <Response>
            {mermaidContent}
          </Response>
        </div>
      </div>
    );
  },
  actions: [
    {
      icon: <CopyIcon className="size-4" />,
      description: 'Copy diagram code to clipboard',
      onClick: () => {
        // This will be handled by the ArtifactViewer component
        // Left as placeholder for compatibility
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon className="size-4" />,
      description: 'Modify diagram',
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Update this diagram to improve clarity and visual appeal',
            },
          ],
        });
      },
    },
  ],
});