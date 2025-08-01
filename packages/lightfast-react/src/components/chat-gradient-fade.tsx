interface ChatGradientFadeProps {
  height?: string;
  className?: string;
}

export function ChatGradientFade({ 
  height = "h-24",
  className = ""
}: ChatGradientFadeProps) {
  return (
    <div className={`absolute -top-24 left-0 right-0 ${height} pointer-events-none ${className}`}>
      <div className="relative h-full">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>
    </div>
  );
}