import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@vendor/db'
import { insertUser } from '@vendor/db/lightfast/prepared-queries'

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '')

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new NextResponse('Error occurred', {
      status: 400
    })
  }

  // Handle the webhook events
  const eventType = evt.type

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    if (!id || !email_addresses?.[0]?.email_address) {
      return new NextResponse('Missing required user data', { status: 400 })
    }

    try {
      // Check if user already exists (for updates)
      const existingUser = await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.clerkId, id),
      })

      if (!existingUser) {
        // Create new user in database
        await insertUser({
          clerkId: id,
          email: email_addresses[0].email_address,
          firstName: first_name || null,
          lastName: last_name || null,
          imageUrl: image_url || null,
        })
        console.log(`User created: ${id}`)
      } else if (eventType === 'user.updated') {
        // Update existing user
        await db.update(user).set({
          email: email_addresses[0].email_address,
          firstName: first_name || null,
          lastName: last_name || null,
          imageUrl: image_url || null,
          updatedAt: new Date(),
        }).where(eq(user.clerkId, id))
        console.log(`User updated: ${id}`)
      }
    } catch (error) {
      console.error('Error handling user webhook:', error)
      return new NextResponse('Database error', { status: 500 })
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data
    
    try {
      // Soft delete or hard delete based on your requirements
      await db.delete(user).where(eq(user.clerkId, id))
      console.log(`User deleted: ${id}`)
    } catch (error) {
      console.error('Error deleting user:', error)
      return new NextResponse('Database error', { status: 500 })
    }
  }

  return new NextResponse('', { status: 200 })
}