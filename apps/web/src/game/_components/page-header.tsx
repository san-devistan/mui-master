import { HoloShop } from "@/game/_components/holo-shop"
import { holos, useWallet } from "@/game/_lib/wallet"
import { GamePill } from "@workspace/ui/components/game-shell"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { useState } from "react"

// Every tab's title, with the player's holos always in the top-right corner.
export function PageHeader({ title }: { title: string }) {
  return (
    <header className="gap-x-3 gap-y-2 flex flex-wrap items-center">
      <h1 className="min-w-0 text-4xl font-black md:text-6xl tracking-tighter flex-1 font-heading">
        {title}
      </h1>
      <HolosPill />
    </header>
  )
}

// The player's holos; tapped, the shop to get more.
function HolosPill() {
  const wallet = useWallet()
  const [shopping, setShopping] = useState(false)
  const coins = wallet?.coins ?? 0
  return (
    <>
      <GamePill
        render={
          <button type="button" aria-label={`${holos(coins)}, get more`} />
        }
        // Tappable even over a page that lets taps through its header (Packs).
        className="pointer-events-auto"
        onClick={() => setShopping(true)}
      >
        <HoloCoin />
        {coins.toLocaleString("en")}
      </GamePill>
      <HoloShop open={shopping} onOpenChange={setShopping} />
    </>
  )
}
