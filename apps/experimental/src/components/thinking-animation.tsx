"use client";

export function ThinkingAnimation() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-2 w-2 rounded-full bg-current animate-bounce"
          style={{
            animationDelay: `${index * 100}ms`,
            animationDuration: "600ms",
          }}
        />
      ))}
    </div>
  );
}