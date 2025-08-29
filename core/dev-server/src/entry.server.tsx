/// <reference types="vinxi/types/server" />
import { createMemoryHistory } from '@tanstack/react-router'
import { StartServer } from '@tanstack/react-start/server'
import { getRouterManifest } from '@tanstack/react-start/router-manifest'

import { router } from './router'

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const history = createMemoryHistory({
    initialEntries: [url.pathname + url.search],
  })

  // Update the history and context
  router.update({
    history,
    context: {
      // Add any request-specific context here
      head: '',
    },
  })

  // Wait for the router to load
  await router.load()

  // Render the app to a string
  const appHtml = StartServer({
    router,
    routerManifest: getRouterManifest(),
  })

  return new Response(appHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}