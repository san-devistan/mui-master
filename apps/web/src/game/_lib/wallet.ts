import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { ConvexError } from "convex/values"
import { useEffect, useState } from "react"

const HOUR = 3_600_000
const pad = (n: number) => String(n).padStart(2, "0")

// Now, ticking every `every` ms, for countdowns.
export function useNow(every = 1000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(timer)
  }, [every])
  return now
}

// The signed-in player's coins, their free packs (one per freePackHours, maxFreePacks held at
// most, counted like freePacks in convex/songs/_lib/economy.ts) and the prices. The free packs
// are recounted every `tick` ms; a countdown asks for every second.
export function useWallet(tick = 30_000) {
  const { data } = useQuery(convexQuery(api.wallet.get, {}))
  const now = useNow(tick)
  if (!data) return null
  const every = data.freePackHours * HOUR
  const from = Math.max(data.freePacksSince, now - data.maxFreePacks * every)
  const freePacks = Math.floor((now - from) / every)
  return {
    coins: data.coins,
    freePacks,
    maxFreePacks: data.maxFreePacks,
    // How far toward the next free pack, 0 to 1; 0 while they're all held.
    nextFreeProgress:
      freePacks < data.maxFreePacks
        ? (now - from - freePacks * every) / every
        : 0,
    // When the next free pack comes; null while they're all held.
    nextFreeAt:
      freePacks < data.maxFreePacks ? from + (freePacks + 1) * every : null,
    // What's left until then, as "7h 59m"; null while they're all held.
    nextFreeIn:
      freePacks < data.maxFreePacks
        ? timeLeft(from + (freePacks + 1) * every, now)
        : null,
    packPrice: data.packPrice,
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

// "1 holo", "1,200 holos": an amount of the game currency.
export const holos = (amount: number) =>
  `${amount.toLocaleString("en")} holo${amount === 1 ? "" : "s"}`

// The message a backend rule gave (ConvexError), or a generic one.
export const errorText = (error: unknown) =>
  error instanceof ConvexError && typeof error.data === "string"
    ? error.data
    : "Something went wrong, try again"
