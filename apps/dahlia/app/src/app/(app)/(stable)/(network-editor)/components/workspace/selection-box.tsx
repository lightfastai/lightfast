import { cn } from "@repo/ui/lib/utils";

interface SelectionBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const SelectionBox: React.FC<SelectionBoxProps> = ({
  startX,
  startY,
  endX,
  endY,
  className,
  ...props
}) => {
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);

  return (
    <div
      {...props}
      className={cn(
        "pointer-events-none absolute border-2 border-blue-500 bg-blue-500/20",
        className,
      )}
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  );
};
