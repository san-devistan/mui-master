import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { useMutation } from "convex/react"
import { useEffect, useState, useSyncExternalStore } from "react"

const noSubscription = () => () => undefined
const canPush = () => "serviceWorker" in navigator && "PushManager" in window

// The VAPID key is base64url; the push manager takes its bytes.
const keyBytes = (key: string) =>
  Uint8Array.from(atob(key.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
    char.charCodeAt(0)
  )

// This device's notifications (free packs, bids, outbids; push.ts): whether the browser can get
// them (iOS only once the app is on the Home Screen), whether they're on, and turning them on or
// off. `supported` and `on` are null while unknown.
export function useNotifications() {
  const { data: key } = useQuery(convexQuery(api.push.publicKey, {}))
  const subscribe = useMutation(api.push.subscribe)
  const unsubscribe = useMutation(api.push.unsubscribe)
  const supported = useSyncExternalStore(noSubscription, canPush, () => null)
  const [on, setOn] = useState<boolean | null>(null)

  useEffect(() => {
    if (!supported) return
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setOn(subscription !== null))
      .catch(() => setOn(false))
  }, [supported])

  async function turnOn() {
    if (!key) throw new Error("Notifications aren't set up yet")
    // Asked first, straight from the tap: Safari only asks from one.
    if ((await Notification.requestPermission()) !== "granted") {
      throw new Error("Notifications are blocked in your browser's settings")
    }
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    })
    const { endpoint, keys } = subscription.toJSON()
    if (!endpoint || !keys?.p256dh || !keys.auth) {
      throw new Error("This browser gave no push subscription")
    }
    await subscribe({
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    })
  }

  async function turnOff() {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    await unsubscribe({ endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  }

  async function toggle(next: boolean) {
    await (next ? turnOn() : turnOff())
    setOn(next)
  }

  return { supported, ready: Boolean(key), on, toggle }
}
