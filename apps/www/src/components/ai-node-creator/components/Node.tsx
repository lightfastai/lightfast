import Image from "next/image";

import type { NodeProps } from "../types";

export const Node = ({
  index,
  position,
  imageSrc,
  onDragStart,
  onDrag,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  isDragged,
}: NodeProps) => {
  return (
    <div
      className="absolute cursor-move select-none overflow-hidden rounded-md border border-border/50 bg-background/80 p-2 shadow-sm"
      style={{
        aspectRatio: "3/2",
        width: "12rem",
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex: isDragged ? 10 : 2,
      }}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDrag={(e) => onDrag(e, index)}
      onDragEnd={onDragEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Image
        src={imageSrc}
        alt={`Node ${index + 1}`}
        width={300}
        height={200}
        className="pointer-events-none h-full w-full border border-border/50 object-cover"
        draggable={false}
      />
    </div>
  );
};
