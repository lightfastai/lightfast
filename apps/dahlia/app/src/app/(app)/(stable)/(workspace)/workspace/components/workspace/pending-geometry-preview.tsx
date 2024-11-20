"use client";

import { useEffect, useState } from "react";
import { Circle, Square, Triangle } from "lucide-react";

interface PendingGeometryPreviewProps {
  geometryType: string | null;
}

interface Position {
  x: number;
  y: number;
}

export const PendingGeometryPreview = ({
  geometryType,
}: PendingGeometryPreviewProps) => {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    if (geometryType) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [geometryType]);

  if (!geometryType) return null;

  const getGeometryIcon = () => {
    switch (geometryType.toLowerCase()) {
      case "box":
        return <Square className="h-6 w-6" />;
      case "sphere":
        return <Circle className="h-6 w-6" />;
      case "plane":
        return <Triangle className="h-6 w-6" />;
      default:
        return null;
    }
  };

  return (
    <div
      className="pointer-events-none fixed z-50 flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white/10 backdrop-blur-sm"
      style={{
        left: position.x - 48, // Center horizontally (half of width)
        top: position.y - 48, // Center vertically (half of height)
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="flex flex-col items-center gap-2 text-gray-600">
        {getGeometryIcon()}
        <span className="text-xs font-medium">{geometryType}</span>
      </div>
    </div>
  );
};
