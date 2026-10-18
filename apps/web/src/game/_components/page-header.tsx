import { holos, useWallet } from "@/game/_lib/wallet"
import { GamePill } from "@workspace/ui/components/game-shell"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import type { ReactNode } from "react"

// Every tab's title, with the player's holos always in the top-right corner
// and `children` (e.g. the Packs page's free packs) just before them.
export function PageHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <header className="gap-x-3 gap-y-2 flex flex-wrap items-center">
      <h1 className="min-w-0 text-4xl font-black md:text-6xl tracking-tighter flex-1 font-heading">
        {title}
      </h1>
      {children}
      <HolosPill />
    </header>
  )
}

function HolosPill() {
  const wallet = useWallet()
  return (
    <GamePill aria-label={holos(wallet?.coins ?? 0)}>
      <HoloCoin />
      {(wallet?.coins ?? 0).toLocaleString("en")}
    </GamePill>
  )
}
