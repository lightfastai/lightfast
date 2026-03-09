"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Submitting...
        </>
      ) : (
        "Get Early Access"
      )}
    </Button>
  );
}
