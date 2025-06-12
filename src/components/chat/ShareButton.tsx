"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Share2, Copy, Check } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

// Note: The 'shares' API will be available after running 'pnpm convex:dev'
// @ts-ignore - Ignoring until Convex types are regenerated
const createShareMutation = api.shares?.createShare

interface ShareButtonProps {
  threadId: Id<"threads">
}

export function ShareButton({ threadId }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [copied, setCopied] = useState(false)

  // @ts-ignore - Ignoring until Convex types are regenerated
  const createShare = useMutation(createShareMutation)

  const handleShare = async () => {
    try {
      const result = await createShare({ threadId })
      // For now, using window.location.origin. You can update this to use env variable later
      const url = `${window.location.origin}/share/${result.shareId}`
      setShareUrl(url)
    } catch (error) {
      console.error("Failed to create share:", error)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Conversation</DialogTitle>
          <DialogDescription>
            Anyone with this link can view this conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-sm" />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              disabled={!shareUrl}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
