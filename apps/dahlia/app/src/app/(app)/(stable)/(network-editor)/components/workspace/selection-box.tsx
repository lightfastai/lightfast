interface SelectionBoxProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const SelectionBox = ({
  startX,
  startY,
  endX,
  endY,
}: SelectionBoxProps) => {
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);

  return (
    <div
      className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/20"
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  );
};
