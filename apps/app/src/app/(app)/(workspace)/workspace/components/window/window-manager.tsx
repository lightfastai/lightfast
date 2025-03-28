import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface WindowManagerProps {
  nodeId: string;
  content: React.ReactNode;
  title: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
}

export function WindowManager({
  nodeId,
  content,
  title,
  width,
  height,
  x,
  y,
  isOpen,
  onClose,
}: WindowManagerProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && !container) {
      const newContainer = document.createElement("div");
      newContainer.id = `window-${nodeId}`;
      newContainer.style.position = "fixed";
      newContainer.style.top = `${y}px`;
      newContainer.style.left = `${x}px`;
      newContainer.style.width = `${width}px`;
      newContainer.style.height = `${height}px`;
      newContainer.style.backgroundColor = "white";
      newContainer.style.border = "1px solid #ccc";
      newContainer.style.borderRadius = "4px";
      newContainer.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      newContainer.style.zIndex = "1000";
      document.body.appendChild(newContainer);
      setContainer(newContainer);
    }

    return () => {
      if (container) {
        document.body.removeChild(container);
        setContainer(null);
      }
    };
  }, [isOpen, container, nodeId, x, y, width, height]);

  if (!isOpen || !container) return null;

  return createPortal(
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-gray-100 px-2 py-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-full p-1 hover:bg-gray-200"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">{content}</div>
    </div>,
    container,
  );
}
