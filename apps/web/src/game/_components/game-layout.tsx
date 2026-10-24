import { CardUpgrades } from "@/game/_components/card-upgrades"
import { InstallPrompt } from "@/game/_components/install-prompt"
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
  { to: "/play", label: "Packs", Icon: BoxIcon },
  { to: "/collection", label: "Collection", Icon: LayersIcon },
  { to: "/market", label: "Market", Icon: GavelIcon },
  { to: "/profile", label: "Profile", Icon: UserIcon },
] as const

export function GameLayout() {
  const ready = useGuestSession()
  useWeeklyHolos(ready)
  const path = useRouterState({ select: (state) => state.location.pathname })
  const onPacks = path === "/play"
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
          the player is on another tab, so it opens ready, and a pack's end on
          it adds only the new cards (a first mount there costs ~1 s of frames
          on a low-end phone). */}
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
      {ready ? <InstallPrompt /> : null}
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
  const refusals = useRef(0)

  useEffect(() => {
    if (isPending || session || requested.current) return
    requested.current = true
    async function signIn() {
      const { error } = await authClient.signIn.anonymous()
      if (!error) return
      // Refused, most often because the visitor has a session the last check didn't get back
      // (Better Auth won't make a second guest): check again, which signs in again if there's
      // still none. Waits longer each time, so a lasting refusal doesn't flood the server.
      const wait = Math.min(1000 * 2 ** refusals.current++, 30_000)
      setTimeout(() => {
        requested.current = false
        authClient.$store.notify("$sessionSignal")
      }, wait)
    }
    void signIn()
  }, [isPending, session])

  return Boolean(session)
}

// Pro's weekly holos, given once the session is ready, when a week has passed since the last.
// The backend checks that, so a remount or a second tab adds nothing.
function useWeeklyHolos(ready: boolean) {
  const claimWeekly = useMutation(api.wallet.claimWeekly)
  useEffect(() => {
    if (ready) void claimWeekly().catch(() => undefined)
  }, [ready, claimWeekly])
}
