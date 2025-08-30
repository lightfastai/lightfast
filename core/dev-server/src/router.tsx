import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/default-catch-boundary'
import { NotFound } from './components/not-found'

export const router = createTanStackRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultErrorComponent: DefaultCatchBoundary,
  defaultNotFoundComponent: () => <NotFound />,
  scrollRestoration: true,
})

export function createRouter() {
  return createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
