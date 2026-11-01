import {
  AccountSettings,
  DangerZone,
} from "@/game/_components/account-settings"
import { AvatarPicker } from "@/game/_components/avatar-picker"
import { BillingSettings } from "@/game/_components/billing-settings"
import { DevTools } from "@/game/_components/dev-tools"
import { PageHeader } from "@/game/_components/page-header"
import { PreferenceSettings } from "@/game/_components/preference-settings"
import { ProfileShowcase } from "@/game/_components/profile-showcase"
import { ReferralSettings } from "@/game/_components/referral-settings"
import { useCardCount } from "@/game/_lib/collection"
import { sharePicture } from "@/game/_lib/share"
import { useWallet } from "@/game/_lib/wallet"
import { authClient } from "@/lib/auth-client"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { GameAvatar } from "@workspace/ui/components/game-avatar"
import { GameMain } from "@workspace/ui/components/game-shell"
import { loadImage } from "@workspace/ui/lib/game/pack-art"
import { drawProfileShare, pngBlob } from "@workspace/ui/lib/game/share-art"
import { CrownIcon, ShareIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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
export function ProfilePage() {
  const { data: session } = authClient.useSession()
  const cards = useCardCount()
  const wallet = useWallet()
  const { data: showcase } = useQuery(convexQuery(api.profile.showcase, {}))
  const { data: avatar } = useQuery(convexQuery(api.profile.avatar, {}))
  const avatarImage = useLoadedImage(avatar?.imageUrl)
  const showcaseRef = useRef<HTMLDivElement>(null)
  const user = session?.user
  const name = profileName(user)
  const stats = profileStats(user?.createdAt, cards)

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
    if (thumbs.length === 0) return
    const picture = drawProfileShare({
      name,
      stats,
      pro: wallet?.pro,
      image: avatarImage,
      cards: thumbs,
    })
    void sharePicture(pngBlob(picture), name)
  }

  return (
    <GameMain layout="scroll">
      <PageHeader title="Profile" />
      <section className="mt-6 gap-4 md:gap-6 flex items-center">
        {/* Pro hangs off the bottom of the picture, over its ring. */}
        <EditableAvatar
          name={name}
          image={avatar?.imageUrl}
          cardId={avatar?.cardId ?? null}
          pro={wallet?.pro === true}
        />
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
        <ShareProfileButton
          ready={(showcase?.length ?? 0) > 0}
          onShare={share}
        />
      </section>
      <div ref={showcaseRef} className="contents">
        <ProfileShowcase />
      </div>
      <AccountSettings />
      <ReferralSettings />
      <BillingSettings />
      <PreferenceSettings />
      <DangerZone />
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

function profileName(
  user:
    | {
        displayUsername?: string | null
        username?: string | null
        name?: string | null
      }
    | undefined
) {
  return user?.displayUsername || user?.username || user?.name || ""
}

function profileStats(createdAt: Date | string | undefined, cards?: number) {
  return [
    {
      label: "Playing for",
      value: createdAt ? playingFor(new Date(createdAt)) : "…",
    },
    { label: "Unique cards", value: (cards ?? 0).toLocaleString("en") },
  ]
}

function useLoadedImage(src: string | undefined) {
  const [loaded, setLoaded] = useState<{
    src: string
    image: HTMLImageElement
  } | null>(null)
  useEffect(() => {
    let current = true
    if (!src) return undefined
    void loadImage(src)
      .then((image) => {
        if (current) setLoaded({ src, image })
        return image
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [src])
  return src && loaded?.src === src ? loaded.image : null
}

function EditableAvatar({
  name,
  image,
  cardId,
  pro,
}: {
  name: string
  image: string | undefined
  cardId: string | null
  pro: boolean
}) {
  const [choosing, setChoosing] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Change your profile picture"
        className="group relative block rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ring"
        onClick={() => setChoosing(true)}
      >
        <GameAvatar name={name} image={image} />
      </button>
      {pro ? (
        <span
          data-slot="pro-badge"
          className="-bottom-2 absolute left-1/2 -translate-x-1/2"
        >
          <CrownIcon aria-hidden="true" />
          Pro
        </span>
      ) : null}
      <AvatarPicker
        current={cardId}
        open={choosing}
        onOpenChange={setChoosing}
      />
    </div>
  )
}

function ShareProfileButton({
  ready,
  onShare,
}: {
  ready: boolean
  onShare: () => void
}) {
  return (
    <Button
      variant="game"
      size="icon-game"
      className="shrink-0"
      disabled={!ready}
      aria-label={
        ready
          ? "Share your profile"
          : "Add a showcase card to share your profile"
      }
      onClick={onShare}
    >
      <ShareIcon aria-hidden="true" />
    </Button>
  )
}
