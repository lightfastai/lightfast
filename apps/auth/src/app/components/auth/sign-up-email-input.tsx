'use client'

import * as React from 'react'
import { useSignUp } from '@clerk/nextjs'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@repo/ui/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@repo/ui/components/ui/form'
import { Icons } from '@repo/ui/components/icons'
import { getErrorMessage, formatErrorForLogging } from '~/app/lib/clerk/error-handling'
import { useLogger } from '@vendor/observability/client-log'

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type EmailFormData = z.infer<typeof emailSchema>

interface SignUpEmailInputProps {
  onSuccess: (email: string) => void
  onError: (error: string) => void
}

export function SignUpEmailInput({ onSuccess, onError }: SignUpEmailInputProps) {
  const { signUp, isLoaded } = useSignUp()
  const log = useLogger()

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: EmailFormData) {
    if (!signUp) return

    try {
      // Create sign-up attempt with email
      await signUp.create({
        emailAddress: data.email,
      })

      // Send verification code
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      })

      log.info('[SignUpEmailInput.onSubmit] Authentication success', { 
        email: data.email,
        timestamp: new Date().toISOString()
      })
      onSuccess(data.email)
    } catch (err) {
      log.error('[SignUpEmailInput.onSubmit] Authentication error', formatErrorForLogging('SignUpEmailInput.onSubmit', err))
      onError(getErrorMessage(err))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Email Address"
                  className="h-12"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full h-12" 
          disabled={!isLoaded || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Continue with Email'
          )}
        </Button>
      </form>
    </Form>
  )
}