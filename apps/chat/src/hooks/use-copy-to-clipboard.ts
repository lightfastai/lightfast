import { useState, useCallback } from 'react';

interface UseCopyToClipboardOptions {
  /**
   * Duration in milliseconds to show the success state
   * @default 2000
   */
  successDuration?: number;
  /**
   * Show toast notification on copy
   * @default false
   */
  showToast?: boolean;
  /**
   * Custom toast message
   */
  toastMessage?: string;
}

interface UseCopyToClipboardReturn {
  /**
   * Function to copy text to clipboard
   */
  copyToClipboard: (text: string) => Promise<void>;
  /**
   * Whether the text was recently copied (shows success state)
   */
  isCopied: boolean;
}

/**
 * Hook for copying text to clipboard with temporary success state
 * 
 * @example
 * ```tsx
 * const { copyToClipboard, isCopied } = useCopyToClipboard({
 *   showToast: true,
 *   toastMessage: "Code copied to clipboard!"
 * });
 * 
 * return (
 *   <button onClick={() => copyToClipboard(text)}>
 *     {isCopied ? <Check className="text-green-600" /> : <Copy />}
 *   </button>
 * );
 * ```
 */
export function useCopyToClipboard({
  successDuration = 2000,
  showToast = false,
  toastMessage = "Copied to clipboard!",
}: UseCopyToClipboardOptions = {}): UseCopyToClipboardReturn {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);

      // Show toast if requested
      if (showToast) {
        // Dynamically import toast to avoid bundling it when not needed
        const { toast } = await import('@repo/ui/hooks/use-toast');
        toast({
          title: toastMessage,
          description: "The content has been copied to your clipboard.",
        });
      }

      // Reset success state after duration
      setTimeout(() => {
        setIsCopied(false);
      }, successDuration);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        setIsCopied(true);
        
        if (showToast) {
          const { toast } = await import('@repo/ui/hooks/use-toast');
          toast({
            title: toastMessage,
            description: "The content has been copied to your clipboard.",
          });
        }
        
        setTimeout(() => {
          setIsCopied(false);
        }, successDuration);
      } catch (fallbackError) {
        console.error('Fallback copy method also failed:', fallbackError);
        
        if (showToast) {
          const { toast } = await import('@repo/ui/hooks/use-toast');
          toast({
            title: "Copy failed",
            description: "Unable to copy to clipboard. Please copy manually.",
            variant: "destructive",
          });
        }
      }
    }
  }, [successDuration, showToast, toastMessage]);

  return {
    copyToClipboard,
    isCopied,
  };
}