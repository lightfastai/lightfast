import { useMemo } from "react";
import Image from "next/image";

import { useIsMobile } from "@repo/ui/hooks/use-mobile";

import type { NodeProps } from "./types";

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
  const isMobile = useIsMobile();
  const isPriority = useMemo(() => index < 3 && !isMobile, [index, isMobile]);

  return (
    <div
      className="border-border/50 bg-background/80 absolute cursor-move overflow-hidden rounded-md border p-2 shadow-sm select-none"
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
      <div className="relative h-full w-full">
        <Image
          src={imageSrc}
          alt={`Node ${index + 1}`}
          sizes="(max-width: 640px) 132px, (max-width: 768px) 160px, 256px"
          quality={75}
          fill
          className="border-border/50 pointer-events-none border object-cover"
          draggable={false}
          loading={isPriority ? "eager" : "lazy"}
          priority={isPriority}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx0eHh0dHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/2wBDAR0XFx4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        />
      </div>
    </div>
  );
};
