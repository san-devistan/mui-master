import { handler } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

// Better Auth's endpoints, forwarded to the Convex deployment.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
})
