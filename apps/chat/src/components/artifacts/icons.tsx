// Icons copied from Vercel AI Chatbot for artifact actions
import { Copy, Play, Redo, Undo, MessageSquare, ScrollText } from 'lucide-react';

export const CopyIcon = ({ size = 18 }: { size?: number }) => (
  <Copy size={size} />
);

export const PlayIcon = ({ size = 18 }: { size?: number }) => (
  <Play size={size} />
);

export const RedoIcon = ({ size = 18 }: { size?: number }) => (
  <Redo size={size} />
);

export const UndoIcon = ({ size = 18 }: { size?: number }) => (
  <Undo size={size} />
);

export const MessageIcon = ({ size = 18 }: { size?: number }) => (
  <MessageSquare size={size} />
);

export const LogsIcon = ({ size = 18 }: { size?: number }) => (
  <ScrollText size={size} />
);