import { DevTools } from "@/game/_components/dev-tools"
import { PageHeader } from "@/game/_components/page-header"
import { ProfileShowcase } from "@/game/_components/profile-showcase"
import { sharePicture } from "@/game/_lib/share"
import { useWallet } from "@/game/_lib/wallet"
import { authClient } from "@/lib/auth-client"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { GameAvatar } from "@workspace/ui/components/game-avatar"
import { GameMain } from "@workspace/ui/components/game-shell"
import {
  APP_NAME,
  drawProfileShare,
  pngBlob,
} from "@workspace/ui/lib/game/share-art"
import { CrownIcon, ShareIcon } from "lucide-react"
import { useRef } from "react"

const DAY = 86_400_000
const unitFormat = (unit: string) =>
  new Intl.NumberFormat("en", { style: "unit", unit, unitDisplay: "long" })
// Days per unit, largest first, each with its formatter.
const UNITS = [
  [365, unitFormat("year")],
  [30, unitFormat("month")],
  [1, unitFormat("day")],
] as const

// How long since `since`, in its largest whole unit: "3 days", "2 months".
// Under a day reads "1 day": a player who just started is on their first.
function playingFor(since: Date) {
  const days = Math.max(1, Math.floor((Date.now() - since.getTime()) / DAY))
  const [size, format] = UNITS.find(([length]) => days >= length) ?? UNITS[2]
  return format.format(Math.floor(days / size))
}

// The player: their picture beside their name and stats (how long they've
// played, how many different cards they own), then the cards they show off.
// Guests play as "Anonymous".
export function ProfilePage() {
  const { data: session } = authClient.useSession()
  const { data: cards } = useQuery(convexQuery(api.collection.count, {}))
  const wallet = useWallet()
  const showcaseRef = useRef<HTMLDivElement>(null)
  const user = session?.user
  const name = user && !user.isAnonymous && user.name ? user.name : "Anonymous"
  const stats = [
    {
      label: "Playing for",
      value: user ? playingFor(new Date(user.createdAt)) : "…",
    },
    { label: "Unique cards", value: (cards ?? 0).toLocaleString("en") },
  ]

  // Shares the profile as a phone-sized picture, with the showcase's cards as
  // they're drawn on the page; drawn synchronously, so the share sheet opens
  // from this tap.
  function share() {
    const thumbs = [
      ...(showcaseRef.current?.querySelectorAll(
        "[data-slot=song-card-thumb] canvas"
      ) ?? []),
    ].filter(
      (canvas): canvas is HTMLCanvasElement =>
        canvas instanceof HTMLCanvasElement && canvas.width > 0
    )
    const picture = drawProfileShare({
      name,
      stats,
      pro: wallet?.pro,
      cards: thumbs,
    })
    void sharePicture(pngBlob(picture), name, `${name} on ${APP_NAME}`)
  }

  return (
    <GameMain layout="scroll">
      <PageHeader title="Profile" />
      <section className="mt-6 gap-4 md:gap-6 flex items-center">
        {/* Pro hangs off the bottom of the picture, over its ring. */}
        <div className="relative shrink-0">
          <GameAvatar name={name} image={user?.image} />
          {wallet?.pro ? (
            <span
              data-slot="pro-badge"
              className="-bottom-2 absolute left-1/2 -translate-x-1/2"
            >
              <CrownIcon aria-hidden="true" />
              Pro
            </span>
          ) : null}
        </div>
        <div className="min-w-0 gap-2 flex flex-1 flex-col">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter truncate font-heading">
            {name}
          </h2>
          <dl className="gap-x-5 gap-y-1 text-sm flex flex-wrap">
            {stats.map((stat) => (
              <ProfileStat key={stat.label} {...stat} />
            ))}
          </dl>
        </div>
        <Button
          variant="game"
          size="icon-game"
          className="shrink-0"
          aria-label="Share your profile"
          onClick={share}
        >
          <ShareIcon aria-hidden="true" />
        </Button>
      </section>
      <div ref={showcaseRef} className="contents">
        <ProfileShowcase />
      </div>
      <DevTools />
    </GameMain>
  )
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col whitespace-nowrap">
      <dt className="text-xs font-semibold tracking-wide text-ink/60 uppercase">
        {label}
      </dt>
      <dd className="text-lg font-black font-heading">{value}</dd>
    </div>
  )
}
