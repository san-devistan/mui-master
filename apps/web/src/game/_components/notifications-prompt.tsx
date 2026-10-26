import { useNotifications } from "@/game/_lib/notifications"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { BellIcon } from "lucide-react"
import { usePostHog } from "posthog-js/react"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

const noSubscription = () => () => undefined
const blockedHere = () =>
  "Notification" in window && Notification.permission === "denied"

// A new account's welcome (/play?welcome=true, from the sign-in's username step): offers to turn
// notifications on for this device. Skipped where the browser can't get them (iOS before the app
// is on the Home Screen), where they're already on, or blocked; the profile's preferences can
// still turn them on. Answered or skipped, the welcome is dropped from the URL.
export function NotificationsPrompt() {
  const navigate = useNavigate()
  const posthog = usePostHog()
  const { supported, ready, on, toggle } = useNotifications()
  const blocked = useSyncExternalStore(noSubscription, blockedHere, () => false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const done = useCallback(
    () => void navigate({ to: "/play", search: {}, replace: true }),
    [navigate]
  )
  // Nothing to ask: unsupported, blocked, or on (also once turned on here).
  const skip = supported === false || blocked || on === true
  useEffect(() => {
    if (skip) done()
  }, [skip, done])

  async function turnOn() {
    setBusy(true)
    setError(null)
    try {
      await toggle(true)
      posthog.capture("notifications_prompt_answered", { enabled: true })
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong"
      )
    } finally {
      setBusy(false)
    }
  }

  function close(open: boolean) {
    if (open) return
    posthog.capture("notifications_prompt_answered", { enabled: false })
    done()
  }

  if (supported !== true || on !== false || blocked) return null
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent variant="game">
        <div className="gap-5 grid">
          <DialogHeader>
            <DialogTitle>Turn on notifications?</DialogTitle>
            <DialogDescription>
              Know when a free pack is ready, when someone bids on your auction,
              and when you&apos;re outbid.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter variant="game">
            <Button
              variant="game"
              className="flex-1"
              disabled={!ready || busy}
              onClick={() => void turnOn()}
            >
              <BellIcon aria-hidden="true" />
              Turn on
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
