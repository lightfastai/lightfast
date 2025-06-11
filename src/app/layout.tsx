import type { Metadata } from "next"
import "./globals.css"
import { ConvexClientProvider } from "@/lib/ConvexProvider"

export const metadata: Metadata = {
  title: "Chat App",
  description: "A Convex Next.js chat application",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}
