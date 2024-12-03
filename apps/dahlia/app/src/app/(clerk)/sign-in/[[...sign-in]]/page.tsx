"use client";

import * as Clerk from "@clerk/elements/common";
import * as SignIn from "@clerk/elements/sign-in";

export default function Page() {
  return (
    <SignIn.Root>
      <SignIn.Step name="start">
        <h1>Sign in to your account</h1>

        <Clerk.Connection name="github">Sign in with GitHub</Clerk.Connection>

        <Clerk.Field name="identifier">
          <Clerk.Label>Email</Clerk.Label>
          <Clerk.Input />
          <Clerk.FieldError />
        </Clerk.Field>

        <SignIn.Action submit>Continue</SignIn.Action>
      </SignIn.Step>
    </SignIn.Root>
  );
}
