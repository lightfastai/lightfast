import { Artifact } from './create-artifact';
import { CodeEditor } from './code-editor';
import {
  CopyIcon,
  MessageIcon,
  LogsIcon,
} from './icons';

type Metadata = Record<string, unknown>;

export const codeArtifact = new Artifact<'code', Metadata>({
  kind: 'code',
  description: 'Useful for code generation and editing.',
  initialize: ({ setMetadata }) => {
    setMetadata({});
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if ((streamPart as { type: string }).type === 'data-codeDelta') {
      const nextContent = (streamPart as { data?: string }).data;

      if (typeof nextContent !== 'string') {
        return;
      }

      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: nextContent,
        isVisible: ((
          draftArtifact.status === 'streaming' &&
          draftArtifact.content.length > 300 &&
          draftArtifact.content.length < 310
        ) || (!draftArtifact.isVisible && nextContent.length >= 300))
          ? true
          : draftArtifact.isVisible,
        status: 'streaming',
      }));
    }
  },
  content: ({ metadata: _metadata, setMetadata: _setMetadata, ...props }) => {
    return (
      <div className="px-1">
        <CodeEditor {...props} />
      </div>
    );
  },
  actions: [
    {
      icon: <CopyIcon className="size-4" />,
      description: 'Copy code to clipboard',
      onClick: () => {
        // This will be handled by the ArtifactViewer component
        // Left as placeholder for compatibility
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon className="size-4" />,
      description: 'Add comments',
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Add comments to the code snippet for understanding',
            },
          ],
        });
      },
    },
    {
      icon: <LogsIcon className="size-4" />,
      description: 'Add logs',
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Add logs to the code snippet for debugging',
            },
          ],
        });
      },
    },
  ],
});
