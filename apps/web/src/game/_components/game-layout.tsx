import { CardUpgrades } from "@/game/_components/card-upgrades"
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
import { lazy, Suspense, useEffect, useRef, useState } from "react"

// Collection and Market load after the first screen: the pack is opened first,
// so their code doesn't hold it up on a slow network or phone. Asked for once
// the pack is drawn (or after a while, or as soon as their tab is opened).
const loadCollection = () => import("@/game/_pages/collection-page")
const loadMarket = () => import("@/game/_pages/market-page")
const CollectionPage = lazy(async () => ({
  default: (await loadCollection()).CollectionPage,
}))
const MarketPage = lazy(async () => ({
  default: (await loadMarket()).MarketPage,
}))
// shortcut: waits for the pack's data-drawn canvas (opening-scene.ts) or 8 s;
// switch to a callback from PackOpening if that attribute ever goes away.
const PAGES_AFTER = 8000

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
  const pagesWanted = usePagesWanted(
    ready,
    path === "/collection" || path === "/market"
  )
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
      {/* Mounted as soon as it's loaded, hidden: its first cards load and draw
          while the player is on another tab, so it opens ready. */}
      {ready && pagesWanted ? (
        <div className="contents" hidden={path !== "/collection"}>
          <Suspense fallback={<PageLoading shown={path === "/collection"} />}>
            <CollectionPage shown={path === "/collection"} />
          </Suspense>
        </div>
      ) : null}
      {/* The same for the market: it keeps its filters, scroll and drawn
          cards across tabs. */}
      {ready && pagesWanted ? (
        <div className="contents" hidden={path !== "/market"}>
          <Suspense fallback={<PageLoading shown={path === "/market"} />}>
            <MarketPage shown={path === "/market"} />
          </Suspense>
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

// While a tab's page is still loading: the same empty space as before sign-in.
function PageLoading({ shown }: { shown: boolean }) {
  return shown ? <div className="min-h-0 flex-1" /> : null
}

// True once Collection and Market should load: the pack is drawn on screen (the
// first screen is playable), PAGES_AFTER has passed, or the player is on one of
// their tabs.
function usePagesWanted(ready: boolean, onTheirTab: boolean) {
  const [wanted, setWanted] = useState(false)
  if (ready && onTheirTab && !wanted) setWanted(true)

  useEffect(() => {
    if (!ready || wanted) return undefined
    const want = () => {
      setWanted(true)
      // Their code starts downloading now, not once they mount.
      void loadCollection().catch(() => undefined)
      void loadMarket().catch(() => undefined)
    }
    const drawn = () =>
      document.querySelector("[data-slot=pack-opening] canvas[data-drawn]")
    if (drawn()) {
      want()
      return undefined
    }
    const observer = new MutationObserver(() => {
      if (drawn()) want()
    })
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-drawn"],
    })
    const timer = setTimeout(want, PAGES_AFTER)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [ready, wanted])

  return wanted
}
