import { useNotifications } from "@/game/_lib/notifications"
import { Switch } from "@workspace/ui/components/switch"
import { useId, useState } from "react"

// The profile's notifications switch, for this device: a free pack ready, a bid on the player's
// auction, being outbid.
export function NotificationSettings() {
  const { supported, ready, on, toggle } = useNotifications()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  async function change(next: boolean) {
    setBusy(true)
    setError(null)
    try {
      await toggle(next)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="notifications-title" className="mt-8 gap-3 grid">
      <h2
        id="notifications-title"
        className="text-2xl font-black tracking-tighter font-heading"
      >
        Notifications
      </h2>
      <div className="gap-3 flex items-center justify-between">
        <label htmlFor={id} className="gap-1 grid">
          <span className="font-bold">Packs and auctions</span>
          <span className="text-sm text-ink/60">
            {supported === false
              ? "Add Holotrack to your Home Screen to get notifications."
              : "A free pack ready, a bid on your auction, or being outbid."}
          </span>
        </label>
        <Switch
          id={id}
          checked={on ?? false}
          disabled={!supported || !ready || on === null || busy}
          onCheckedChange={(next) => void change(next)}
        />
      </div>
      {error ? (
        <output className="text-sm font-bold text-destructive">{error}</output>
      ) : null}
    </section>
  )
}
