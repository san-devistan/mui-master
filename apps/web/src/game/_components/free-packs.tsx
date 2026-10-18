import { useWallet } from "@/game/_lib/wallet"
import { PackMeter } from "@workspace/ui/components/pack-meter"
import { ClockIcon } from "lucide-react"

// The free packs held, filling toward the next with its countdown (MAX once all are held), and
// the bought packs waiting on top of them as one pack with a ×count.
export function FreePacks() {
  // Every second, for the countdown and the fill.
  const wallet = useWallet(1000)
  if (!wallet) return null
  const { freePacks, maxFreePacks, nextFreeIn, boughtPacks } = wallet
  return (
    <PackMeter
      held={freePacks}
      max={maxFreePacks}
      progress={wallet.nextFreeProgress}
      extra={boughtPacks}
      aria-label={`${freePacks} of ${maxFreePacks} free packs${
        boughtPacks ? `, ${boughtPacks} bought` : ""
      }${nextFreeIn ? `, next in ${nextFreeIn}` : ""}`}
      badge={
        nextFreeIn ? (
          <>
            <ClockIcon aria-hidden="true" />
            {nextFreeIn}
          </>
        ) : (
          "MAX"
        )
      }
    />
  )
}
