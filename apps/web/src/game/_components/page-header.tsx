import { HoloShop } from "@/game/_components/holo-shop"
import { useFlags } from "@/game/_lib/flags"
import { holos, useNow } from "@/game/_lib/wallet"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { GamePill } from "@workspace/ui/components/game-shell"
import { HoloCoin } from "@workspace/ui/components/holo-coin"
import { Marquee } from "@workspace/ui/components/marquee"
import { CrownIcon } from "lucide-react"
import { useState } from "react"

// The player's holos and whether they're Pro: only these, so a pack opened
// (its free packs recounted) doesn't re-render every tab's header. Pro is
// rechecked as useWallet does, every 30 s.
function useHeaderWallet() {
  const { data } = useQuery({
    ...convexQuery(api.wallet.get, {}),
    select: ({ coins, proUntil }) => ({ coins, proUntil }),
  })
  const pro = useNow(30_000) < (data?.proUntil ?? 0)
  return data ? { coins: data.coins, pro } : null
}

// Every tab's title, sliding when too long for its line, with going Pro and the player's holos
// always in the top-right corner. Both open the shop, with premium on (flags.ts); off, there's
// no Pro and the holos are just shown.
export function PageHeader({ title }: { title: string }) {
  const wallet = useHeaderWallet()
  const { premium } = useFlags()
  const [shopping, setShopping] = useState(false)
  const coins = wallet?.coins ?? 0
  return (
    <header className="gap-3 flex items-center">
      <h1 className="min-w-0 text-4xl font-black md:text-6xl tracking-tighter flex-1 font-heading">
        <Marquee>{title}</Marquee>
      </h1>
      {premium && wallet && !wallet.pro ? (
        <Button
          variant="game"
          size="icon-game"
          data-pro-action
          // Tappable even over a page that lets taps through its header (Packs).
          className="pointer-events-auto"
          aria-label="Go Pro"
          onClick={() => setShopping(true)}
        >
          <CrownIcon aria-hidden="true" />
          <span data-slot="pro-action-label" aria-hidden="true">
            Go Pro
          </span>
        </Button>
      ) : null}
      {premium ? (
        <GamePill
          render={
            <button type="button" aria-label={`${holos(coins)}, get more`} />
          }
          className="pointer-events-auto"
          onClick={() => setShopping(true)}
        >
          <HoloCoin />
          {coins.toLocaleString("en")}
        </GamePill>
      ) : (
        <GamePill aria-label={holos(coins)}>
          <HoloCoin />
          {coins.toLocaleString("en")}
        </GamePill>
      )}
      {premium ? <HoloShop open={shopping} onOpenChange={setShopping} /> : null}
    </header>
  )
}
