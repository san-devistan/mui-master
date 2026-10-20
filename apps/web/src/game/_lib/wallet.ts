import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { ConvexError } from "convex/values"
import { useLayoutEffect, useState } from "react"

const HOUR = 3_600_000
const pad = (n: number) => String(n).padStart(2, "0")

// Now, ticking every `every` ms, for countdowns; fresh again whenever `every`
// changes (a hidden page ticking slower, shown again).
export function useNow(every = 1000) {
  const [now, setNow] = useState(Date.now)
  // A layout effect: a page shown again (ticking faster) counts from now in
  // the very frame it shows, never from its last slow tick.
  useLayoutEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, every)
    return () => clearInterval(timer)
  }, [every])
  return now
}

// The signed-in player's coins, Pro, their free packs (one per freePackHours, maxFreePacks held
// at most, or Pro's faster plan; counted like freePacks in convex/songs/_lib/economy.ts) and the
// prices. The free packs are recounted every `tick` ms; a countdown asks for every second.
export function useWallet(tick = 30_000) {
  const { data } = useQuery(convexQuery(api.wallet.get, {}))
  const now = useNow(tick)
  if (!data) return null
  const pro = (data.proUntil ?? 0) > now
  const maxFreePacks = pro ? data.proMaxFreePacks : data.maxFreePacks
  const every = (pro ? data.proFreePackHours : data.freePackHours) * HOUR
  const from = Math.max(data.freePacksSince, now - maxFreePacks * every)
  const freePacks = Math.floor((now - from) / every)
  const nextFreeAt =
    freePacks < maxFreePacks ? from + (freePacks + 1) * every : null
  return {
    coins: data.coins,
    pro,
    freePacks,
    maxFreePacks,
    // Packs bought with coins, kept until opened on top of the free ones.
    boughtPacks: data.boughtPacks,
    // Every pack ready to open: free and bought.
    packs: freePacks + data.boughtPacks,
    // How far toward the next free pack, 0 to 1; 0 while they're all held.
    nextFreeProgress:
      freePacks < maxFreePacks ? (now - from - freePacks * every) / every : 0,
    // When the next free pack comes; null while they're all held.
    nextFreeAt,
    // What's left until then, as "7h 59m"; null while they're all held.
    nextFreeIn: nextFreeAt === null ? null : timeLeft(nextFreeAt, now),
    // Holos to have the next free pack now: the share of a pack's price still left to wait, as
    // wallet:skipFreePack charges (economy.ts skipPrice); null while they're all held.
    skipPrice:
      nextFreeAt === null
        ? null
        : Math.max(1, Math.ceil((data.packPrice * (nextFreeAt - now)) / every)),
    packPrice: data.packPrice,
    maxPacksBought: data.maxPacksBought,
    sellPrice: data.sellPrice,
    auctionHours: data.auctionHours,
  }
}

// "1h 05m", "4m 09s": what's left until `at`.
export function timeLeft(at: number, now: number) {
  const seconds = Math.max(0, Math.ceil((at - now) / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours
    ? `${hours}h ${pad(minutes)}m`
    : `${minutes}m ${pad(seconds % 60)}s`
}

// "18 Oct": the day an auction was won, in the player's own time zone.
export const wonOn = (at: number) =>
  new Date(at).toLocaleDateString("en", { day: "numeric", month: "short" })

// "1 holo", "1,200 holos": an amount of the game currency.
export const holos = (amount: number) =>
  `${amount.toLocaleString("en")} holo${amount === 1 ? "" : "s"}`

// The message a backend rule gave (ConvexError), or a generic one.
export const errorText = (error: unknown) =>
  error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : "Something went wrong, try again"
