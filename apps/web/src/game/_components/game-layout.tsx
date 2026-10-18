import { CardUpgrades } from "@/game/_components/card-upgrades"
import { CollectionPage } from "@/game/_pages/collection-page"
import { MarketPage } from "@/game/_pages/market-page"
import { PacksPage } from "@/game/_pages/packs-page"
import { authClient } from "@/lib/auth-client"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import {
  GameShell,
  GameTab,
  GameTabBar,
} from "@workspace/ui/components/game-shell"
import { useMutation } from "convex/react"
import { BoxIcon, GavelIcon, LayersIcon, UserIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const TABS = [
  { to: "/", label: "Packs", Icon: BoxIcon },
  { to: "/collection", label: "Collection", Icon: LayersIcon },
  { to: "/market", label: "Market", Icon: GavelIcon },
  { to: "/profile", label: "Profile", Icon: UserIcon },
] as const

export function GameLayout() {
  const ready = useGuestSession()
  useDailyHolos(ready)
  const path = useRouterState({ select: (state) => state.location.pathname })
  const onPacks = path === "/"
  // Once shown, the Packs page stays mounted, hidden on other tabs, so coming
  // back finds its pack just as it was: no rebuild, no blink. An opened pack
  // isn't kept: leaving it mounts a fresh page, with the next pack.
  const [packsShown, setPacksShown] = useState(onPacks)
  const [packOpened, setPackOpened] = useState(false)
  if (onPacks && !packsShown) setPacksShown(true)
  if (!onPacks && packOpened) {
    setPackOpened(false)
    setPacksShown(false)
  }

  return (
    <GameShell>
      {ready ? <Outlet /> : null}
      {ready && packsShown ? (
        <div className="contents" hidden={!onPacks}>
          <PacksPage onOpen={() => setPackOpened(true)} />
        </div>
      ) : null}
      {/* Mounted from the start, hidden: its first cards load and draw while
          the player is on another tab, so it opens ready. */}
      {ready ? (
        <div className="contents" hidden={path !== "/collection"}>
          <CollectionPage shown={path === "/collection"} />
        </div>
      ) : null}
      {/* The same for the market: it keeps its filters, scroll and drawn
          cards across tabs. */}
      {ready ? (
        <div className="contents" hidden={path !== "/market"}>
          <MarketPage shown={path === "/market"} />
        </div>
      ) : null}
      {ready ? null : <div className="min-h-0 flex-1" />}
      {ready ? <CardUpgrades /> : null}
      <GameTabBar aria-label="Main">
        {TABS.map(({ to, label, Icon }) => (
          <GameTab
            key={to}
            // Query params (like the collection's `added`) don't change the tab.
            render={
              <Link
                to={to}
                activeOptions={{ exact: true, includeSearch: false }}
              />
            }
            aria-label={label}
          >
            <Icon aria-hidden="true" />
          </GameTab>
        ))}
      </GameTabBar>
    </GameShell>
  )
}

// Everyone plays as an anonymous guest until accounts can be linked: a visitor without a session
// gets one on arrival. True once a session exists.
function useGuestSession() {
  const { data: session, isPending } = authClient.useSession()
  const requested = useRef(false)

  useEffect(() => {
    if (isPending || session || requested.current) return
    requested.current = true
    async function signIn() {
      const { error } = await authClient.signIn.anonymous()
      // Let a later render retry, after a network error say.
      if (error) requested.current = false
    }
    void signIn()
  }, [isPending, session])

  return Boolean(session)
}

// Pro's daily holos, given once the session is ready: each day the app is opened. The backend
// gives them at most once a day, so a remount or a second tab adds nothing.
function useDailyHolos(ready: boolean) {
  const claimDaily = useMutation(api.wallet.claimDaily)
  useEffect(() => {
    if (ready) void claimDaily().catch(() => undefined)
  }, [ready, claimDaily])
}
