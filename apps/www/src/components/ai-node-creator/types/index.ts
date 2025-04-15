export interface NodePosition {
  x: number;
  y: number;
}

export interface Edge {
  from: number;
  to: number;
}

export interface EdgePosition {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  active: boolean;
}

export interface GenerationLog {
  time: string;
  message: string;
}

export interface NodeProps {
  index: number;
  position: NodePosition;
  imageSrc: string;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDrag: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isDragged: boolean;
}

export interface NodesContainerProps {
  children: React.ReactNode;
  edges: EdgePosition[];
}

export interface CommandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  suggestedPrompts: string[];
  isGenerating: boolean;
  generationLogs: GenerationLog[];
}
