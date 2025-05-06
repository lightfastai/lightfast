import { useEffect } from "react";

interface UseSessionResumableProps {
  autoResume: boolean;
  sessionId: string | null;
  experimental_resume: () => void;
}

/**
 * Custom hook to handle resumable chat sessions.
 * Calls experimental_resume if autoResume and sessionId are present.
 */
export function useSessionResumable({
  autoResume,
  sessionId,
  experimental_resume,
}: UseSessionResumableProps) {
  useEffect(() => {
    if (autoResume && sessionId && experimental_resume) {
      console.log(`Attempting to resume chat for session: ${sessionId}`);
      experimental_resume();
    }
  }, [autoResume, sessionId, experimental_resume]);
}
