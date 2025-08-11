export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: MessagePart[];
  attachments?: Attachment[];
  createdAt: Date;
}

export type MessagePart = 
  | { type: "text"; text: string }
  | { type: "tool-call"; toolName: string; args: any; result?: any }
  | { type: "image"; url: string }
  | { type: "file"; url: string; name: string };

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Chat {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  visibility: "public" | "private";
}

export interface User {
  id: string;
  email: string;
}