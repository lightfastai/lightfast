import { Artifact } from './create-artifact';
import { CodeEditor } from './code-editor';
import {
  CopyIcon,
  RedoIcon,
  UndoIcon,
  MessageIcon,
  LogsIcon,
} from './icons';
import { toast } from '@repo/ui/hooks/use-toast';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Metadata {
  // Empty for now - can be extended later for console outputs, etc.
}

export const codeArtifact = new Artifact<'code', Metadata>({
  kind: 'code',
  description: 'Useful for code generation and editing.',
  initialize: ({ setMetadata }) => {
    setMetadata({});
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if ((streamPart as { type: string }).type === 'data-codeDelta') {
      setArtifact((draftArtifact) => {
        const newContent = draftArtifact.content + (streamPart as { data: string }).data;
        return {
          ...draftArtifact,
          content: newContent,
          isVisible:
            draftArtifact.status === 'streaming' &&
            newContent.length > 300 &&
            newContent.length < 310
              ? true
              : draftArtifact.isVisible,
          status: 'streaming',
        };
      });
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
      icon: <UndoIcon className="size-4" />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <RedoIcon className="size-4" />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <CopyIcon className="size-4" />,
      description: 'Copy code to clipboard',
      onClick: ({ content }) => {
        void navigator.clipboard.writeText(content);
        toast({
          title: 'Copied to clipboard!',
          description: 'Code has been copied to your clipboard.',
        });
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