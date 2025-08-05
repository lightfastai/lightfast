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

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(data: EmailFormData) {
    if (!signIn || !isLoaded) return

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

      onSuccess(data.email)
    } catch (err) {
      console.error('Email sign-in error:', err)
      
      if (err instanceof Error) {
        onError(err.message)
      } else if (typeof err === 'object' && err !== null && 'errors' in err) {
        const clerkError = err as { errors?: { longMessage?: string }[] }
        if (clerkError.errors?.[0]?.longMessage) {
          onError(clerkError.errors[0].longMessage)
        } else {
          onError('An error occurred. Please try again.')
        }
      } else {
        onError('An error occurred. Please try again.')
      }
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
                  placeholder="Enter your email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={!isLoaded || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Sign In with Email'
          )}
        </Button>
      </form>
    </Form>
  )
}