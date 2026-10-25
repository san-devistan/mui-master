import { authClient } from "@/lib/auth-client"
import { PostHogProvider, usePostHog } from "posthog-js/react"
import { useEffect, useRef } from "react"

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST

// PostHog for the whole app: pageviews, autocaptured clicks, errors and the game's own events.
// Without its env values (a fork, a preview) the app runs as is, untracked.
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!posthogKey || !posthogHost) {
    if (import.meta.env.DEV) {
      console.warn(
        "PostHog is off: set VITE_PUBLIC_POSTHOG_PROJECT_TOKEN and VITE_PUBLIC_POSTHOG_HOST in .env.local."
      )
    }
    return children
  }

  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{
        api_host: posthogHost,
        capture_exceptions: true,
        defaults: "2025-05-24",
        debug: import.meta.env.DEV,
        // The landing scrolls in its own container, not the window: measure
        // that for the pageview's scroll depth, the window everywhere else.
        scroll_root_selector: ["[data-slot=landing-scroll]", "html"],
      }}
    >
      <PlayerIdentity />
      {children}
    </PostHogProvider>
  )
}

// Signed-in players are identified by their account; visitors stay anonymous, and signing out
// starts a fresh anonymous person.
function PlayerIdentity() {
  const posthog = usePostHog()
  const { data: session } = authClient.useSession()
  const user = session?.user
  const userId = user?.id
  const identifiedUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!userId) {
      if (identifiedUserId.current) {
        posthog.reset()
        identifiedUserId.current = undefined
      }
      return
    }

    if (identifiedUserId.current && identifiedUserId.current !== userId) {
      posthog.reset()
    }

    posthog.identify(userId, {
      email: user?.email,
      name: user?.name,
      username: user?.username,
      display_username: user?.displayUsername,
    })
    identifiedUserId.current = userId
  }, [
    posthog,
    userId,
    user?.email,
    user?.name,
    user?.username,
    user?.displayUsername,
  ])

  return null
}
