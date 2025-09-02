import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Redirect to agents page
    throw redirect({
      to: '/agents',
    })
  },
})