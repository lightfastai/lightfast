import { Skeleton } from "@/components/ui/skeleton"

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in-0 duration-300">
      {/* Messages area skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Skeleton messages */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
          >
            <div className={`max-w-[70%] ${i % 2 === 0 ? "" : "text-right"}`}>
              <Skeleton
                className={`h-4 ${i % 2 === 0 ? "w-48" : "w-64"} mb-2`}
              />
              <Skeleton className={`h-16 ${i % 2 === 0 ? "w-72" : "w-56"}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Input area skeleton */}
      <div className="border-t p-4">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}
