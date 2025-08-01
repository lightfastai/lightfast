interface ChatDisclaimerProps {
  text?: string;
  className?: string;
}

export function ChatDisclaimer({ 
  text = "This is an experiment by Lightfast. Use with discretion.",
  className = ""
}: ChatDisclaimerProps) {
  return (
    <p className={`text-xs text-muted-foreground text-center ${className}`}>
      {text}
    </p>
  );
}