// Icons copied from Vercel AI Chatbot for artifact actions
import { Copy, Play, Redo, Undo, MessageSquare, ScrollText } from 'lucide-react';

export const CopyIcon = ({ className }: { className?: string }) => (
  <Copy className={className} />
);

export const PlayIcon = ({ className }: { className?: string }) => (
  <Play className={className} />
);

export const RedoIcon = ({ className }: { className?: string }) => (
  <Redo className={className} />
);

export const UndoIcon = ({ className }: { className?: string }) => (
  <Undo className={className} />
);

export const MessageIcon = ({ className }: { className?: string }) => (
  <MessageSquare className={className} />
);

export const LogsIcon = ({ className }: { className?: string }) => (
  <ScrollText className={className} />
);