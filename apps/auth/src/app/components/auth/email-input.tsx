'use client'

import * as React from 'react'
import { useSignIn } from '@clerk/nextjs'
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

interface EmailInputProps {
  onSuccess: (email: string) => void
  onError: (error: string) => void
}

export function EmailInput({ onSuccess, onError }: EmailInputProps) {
  const { signIn, isLoaded } = useSignIn()
  const log = useLogger()

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: EmailFormData) {
    if (!signIn) return

    try {
      // Create sign-in attempt with email
      await signIn.create({
        identifier: data.email,
      })

      // Send verification code
      const emailFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code'
      )

      if (!emailFactor?.emailAddressId) {
        throw new Error('Email verification is not supported')
      }

      await signIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor.emailAddressId,
      })

      log.info('[EmailInput.onSubmit] Authentication success', { 
        email: data.email,
        timestamp: new Date().toISOString()
      })
      onSuccess(data.email)
    } catch (err) {
      log.error('[EmailInput.onSubmit] Authentication error', formatErrorForLogging('EmailInput.onSubmit', err))
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
                  className="h-12 bg-background dark:bg-background"
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