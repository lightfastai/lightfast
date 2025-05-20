"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { OTPField } from "@repo/ui/components/ui/form";

export default function CodeAuthRoute() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const resend = searchParams.get("resend");
  const claims = useClaims();
  // const isPending = useNavigation().state !== "idle";

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickAway() {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }

    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener("click", handleClickAway);

    return () => {
      el.removeEventListener("click", handleClickAway);
    };
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-center text-xl">Enter pin code</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            method="post"
            action={`${"http://localhost:3001"}/email/authorize`}
            className="grid gap-4"
          >
            {error === "invalid_code" && <FormAlert message={"Invalid code"} />}
            <FormMessage
              message={`${resend ? "Code resent" : "Code sent"} to ${claims?.email}`}
            />
            <input type="hidden" name="action" value="verify" />
            <OTPField
              className="place-self-center"
              ref={inputRef}
              inputProps={{
                type: "text",
                className: "uppercase",
                name: "code",
                required: true,
                autoComplete: "one-time-code",
                autoFocus: true,
                onComplete: () => {
                  if (!formRef.current) return;
                  formRef.current.submit();
                },
              }}
            />
            {/* {isPending ? (
              <div className="flex items-center justify-center">
                <Loader2Icon className="size-8 animate-spin" />
              </div>
            ) : null} */}
          </form>
        </CardContent>
        <CardFooter>
          <form
            method="post"
            action={`${"http://localhost:3001"}/email/authorize`}
            className="w-full"
          >
            {Object.entries(claims).map(([key, value]) => (
              <input
                key={key}
                type="hidden"
                name={key}
                value={value as string}
                className="hidden"
              />
            ))}
            <input type="hidden" name="action" value="resend" />
            <p className="text-muted-foreground w-full text-center text-sm">
              Did not receive a code?{" "}
              <button type="submit" className="text-primary hover:underline">
                Resend code
              </button>
            </p>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

function FormAlert({ message }: { message: string }) {
  return (
    <div
      data-component="alert"
      className="mb-4 rounded border border-red-300 bg-red-100 p-4 text-red-700"
    >
      {message}
    </div>
  );
}

function FormMessage({ message }: { message: string }) {
  return (
    <div
      data-component="alert"
      className="mb-4 rounded border border-green-300 bg-green-100 p-4 text-center text-green-700"
    >
      {message}
    </div>
  );
}

function useClaims() {
  const searchParams = useSearchParams();
  const claims = searchParams.get("claims");
  try {
    return claims ? JSON.parse(claims) : null;
  } catch {
    return null;
  }
}
