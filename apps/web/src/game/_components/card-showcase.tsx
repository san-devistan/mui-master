import { CardTrade } from "@/game/_components/card-trade"
import { ListenRow } from "@/game/_components/listen-links"
import { RelatedCards } from "@/game/_components/related-cards"
import { useSongPreview } from "@/game/_hooks/use-song-preview"
import type { CollectedSong } from "@/game/_lib/collection"
import { Button } from "@workspace/ui/components/button"
import { Celebration } from "@workspace/ui/components/celebration"
import { CountBadge } from "@workspace/ui/components/count-badge"
import { GameMotes } from "@workspace/ui/components/game-motes"
import { GameStage } from "@workspace/ui/components/game-stage"
import {
  SongCard,
  type SongCardHandle,
} from "@workspace/ui/components/song-card"
import type { CardSlot } from "@workspace/ui/lib/game/card-scene"
import { FLY, REVEAL_PLAYED } from "@workspace/ui/lib/game/reveal-motion"
import { play } from "@workspace/ui/lib/game/sfx"
import { ChevronDownIcon, XIcon } from "lucide-react"
import {
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useEventListener } from "usehooks-ts"

// The showcase: the card lands above a bottom panel of song facts, playback
// and links, and the close button. Sizes in CSS px.
const CARD_RATIO = 336 / 240
// How far below the card the facts sit, as a share of its height: inside the
// mirror, so it fades out just behind them. Space is kept clear above the
// card for its bob and lift.
const MIRROR = 0.13
const TOP_GAP = 48
// The facts sit this much lower than the card's mirror alone would put them.
const FACTS_DROP = 16
// Seconds the panel's rows take to come in, one after the other (each row's
// fade plus the stagger before the last, as in the panel's classes): timed to
// be fully in as the card's reveal ends.
const PANEL_IN = 0.5 + 0.2
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

// "1991-09-24" as "24 Sep 1991", the same for everyone (no locale or zone).
function releaseDay(date: string) {
  const [year, month, day] = date.split("-")
  const name = MONTHS[Number(month) - 1]
  return [day && String(Number(day)), name, year].filter(Boolean).join(" ")
}

// Where the showcased card lands: as big as the pile allows, sitting low so
// its mirror fades out behind the facts text (`factsAt`, its middle, in px).
function landing(width: number, height: number, factsAt: number) {
  const room = factsAt - FACTS_DROP - TOP_GAP
  const cardWidth = Math.min(
    312,
    width - 48,
    room / (CARD_RATIO * (1 + MIRROR))
  )
  const cardHeight = cardWidth * CARD_RATIO
  const bottom = factsAt - FACTS_DROP - cardHeight * MIRROR
  return { width: cardWidth, y: bottom - cardHeight / 2 - height / 2 }
}

// The picked card, the grid slot it flies from, and where it is in its trip:
// still sitting on its thumb, out on show, or flying home.
export type Showcase = {
  song: CollectedSong
  from: CardSlot | undefined
  phase: "lifting" | "shown" | "returning"
}

// Scrolls `scroller` back to its top, smoothly; resolves once there.
function scrollHome(scroller: HTMLElement | null) {
  if (!scroller?.scrollTop) return Promise.resolve()
  return new Promise<void>((resolve) => {
    // Browsers without scrollend settle within the timeout.
    const timer = setTimeout(resolve, 450)
    scroller.addEventListener(
      "scrollend",
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
    scroller.scrollTo({ top: 0, behavior: "smooth" })
  })
}

// What the showcase's action rows get: the card shown, its close button to
// place among them, `close` to send the card home, `picture` for a PNG of it
// (null before it's drawn), `onTraded` to report copies that left, and the
// screen's own `context`.
export type ShowcaseActionsProps<Context = unknown> = {
  song: CollectedSong
  closeButton: ReactNode
  close: () => void
  picture: () => Blob | null
  onTraded: (count: number) => void
  context: Context
}

// What a screen showing a card can set in place of the collection's: the
// facts under it, its action rows (a component defined once, given
// `context`), and what scrolls up below.
export type ShowcaseParts = {
  facts?: ReactNode
  below?: ReactNode
} & (
  | { Actions?: undefined; context?: undefined }
  | {
      // oxlint-disable-next-line typescript/no-explicit-any -- each screen's own context
      Actions: ComponentType<ShowcaseActionsProps<any>>
      context: unknown
    }
)

// The showcase scrolls: the card on its first screen, its related cards
// below. `onRelated` opens one of those the player owns, from its thumb.
export function CardDetail({
  showcase: { song, from, phase },
  home,
  onShown,
  onReturn,
  onClose,
  onRelated = () => undefined,
  covered = false,
  parts = {},
}: {
  showcase: Showcase
  home: () => CardSlot | null
  onShown: () => void
  onReturn: () => void
  onClose: () => void
  onRelated?: (
    song: CollectedSong,
    from: CardSlot | undefined,
    opener: HTMLButtonElement
  ) => void
  // Another card is out on show over this one.
  covered?: boolean
  parts?: ShowcaseParts
}) {
  const scrollerRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<SongCardHandle>(null)
  const factsRef = useRef<HTMLDListElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [landed, setLanded] = useState(false)
  // The facts, links and close button come in over the end of the reveal, so
  // they are all in as the card's animation ends.
  const [settled, setSettled] = useState(false)
  // Measured once the panel is laid out, before the card mounts.
  const [land, setLand] = useState<ReturnType<typeof landing> | null>(null)
  // Copies sold or put up from here; the showcase holds the card as it was picked.
  const [traded, setTraded] = useState(0)
  const copies = song.copies - traded
  const shownSong = traded ? { ...song, copies } : song
  const Actions = parts.Actions ?? CollectionActions
  const preview = useSongPreview(song.previewSongId, song.preview)
  // Out on show, between take-off and heading home.
  const flying = phase === "shown"
  // The song is fully in once the card has landed and its reveal has played:
  // it fades in over the end of the reveal.
  const autoplay = useEffectEvent((by: number) => preview.autoplay(by))

  useLayoutEffect(() => {
    const box = factsRef.current?.getBoundingClientRect()
    // Less the 1rem the panel rises by as it shows.
    const at = box ? box.top + box.height / 2 - 16 : innerHeight
    const next = landing(innerWidth, innerHeight, at)
    setLand(next)
    // The card sits off the stage's middle; centre its celebration on it.
    const stage = stageRef.current
    const screen = stage?.parentElement?.getBoundingClientRect()
    if (stage && screen) {
      const frame = stage.getBoundingClientRect()
      const cardY = screen.top + screen.height / 2 + next.y
      stage.style.setProperty(
        "--celebration-y",
        `${cardY - frame.top - frame.height / 2}px`
      )
    }
  }, [])

  // Starts once the big card is drawn over its thumb.
  function takeOff() {
    onShown()
    closeRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!flying) return undefined
    const timers: Array<ReturnType<typeof setTimeout>> = []
    timers.push(setTimeout(() => setLanded(true), FLY * 1000))
    const played = FLY + REVEAL_PLAYED[song.rarity]
    timers.push(
      setTimeout(() => setSettled(true), Math.max(0, played - PANEL_IN) * 1000)
    )
    void autoplay(played)
    play("lift")
    timers.push(setTimeout(() => play(song.rarity), FLY * 1000))
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [song, flying])

  async function close() {
    if (phase === "returning") return
    preview.stop()
    onReturn()
    setLanded(false)
    setSettled(false)
    // The card heads home from its own screen, not scrolled off it.
    await scrollHome(scrollerRef.current)
    play("swipe")
    await cardRef.current?.flyBack(home)
    onClose()
  }

  const closeButton = (
    <Button
      ref={closeRef}
      variant="game"
      size="icon-game"
      onClick={() => void close()}
      aria-label="Close"
    >
      <XIcon aria-hidden="true" />
    </Button>
  )

  useEventListener("keydown", (event) => {
    // Only the card on top closes.
    if (event.key === "Escape" && !covered) void close()
  })

  return (
    <dialog
      ref={scrollerRef}
      open
      aria-label={song.title}
      inert={covered}
      data-covered={covered || undefined}
      // The celebration sits in the fixed stage; keep it on the scrolling card.
      onScroll={(event) =>
        stageRef.current?.style.setProperty(
          "--celebration-scroll",
          `${event.currentTarget.scrollTop}px`
        )
      }
      className="inset-0 p-0 m-0 fixed z-30 game-no-scrollbar size-full max-h-none max-w-none overflow-y-auto overscroll-contain bg-transparent text-ink transition-opacity duration-300 data-covered:opacity-0"
    >
      {/* The card's own screen, as before; the related cards scroll up
          under it. The motes stay behind both. */}
      <div className="inset-0 md:p-8 pointer-events-none fixed">
        <GameStage
          ref={stageRef}
          shape="screen"
          className="md:max-w-md md:max-h-216 md:aspect-393/852 md:w-auto mx-auto size-full"
        >
          <GameMotes shown={flying} />
          {landed && (song.rarity === "epic" || song.rarity === "legendary") ? (
            <Celebration rarity={song.rarity} />
          ) : null}
        </GameStage>
      </div>
      <div className="relative h-full">
        {/* The whole viewport, so the card can fly from anywhere in the grid. */}
        {land ? (
          <SongCard
            ref={cardRef}
            song={song}
            from={from}
            land={land}
            reveal={!from}
            onReady={takeOff}
            // Swiping up and down scrolls to the related cards; sideways tilts.
            className="touch-pan-y"
          />
        ) : null}
        {copies > 1 ? (
          <div
            data-shown={flying || undefined}
            className="inset-x-0 top-0 px-5 md:px-8 md:pt-8 -translate-y-4 data-shown:translate-y-0 pointer-events-none absolute flex justify-end game-safe-top opacity-0 transition duration-150 data-shown:opacity-100 data-shown:duration-300"
          >
            <CountBadge count={copies} />
          </div>
        ) : null}
        <div
          data-shown={flying || undefined}
          data-settled={settled || undefined}
          className="group/panel inset-x-0 bottom-0 pb-3 md:pb-5 pointer-events-none absolute data-shown:pointer-events-auto"
        >
          {/* Each row rises and fades in over the end of the reveal, one after
            the other; they leave together, quickly, as the card heads home. */}
          <div className="max-w-md px-5 gap-4 *:translate-y-3 *:ease-out group-data-settled/panel:*:translate-y-0 mx-auto flex flex-col items-center *:opacity-0 *:transition *:duration-150 group-data-settled/panel:*:opacity-100 group-data-settled/panel:*:duration-500 group-data-settled/panel:*:nth-2:delay-100 group-data-settled/panel:*:nth-3:delay-200">
            {/* One centred group, each fact as wide as its value, so a long
              date doesn't pull the weight to one side. */}
            <dl
              ref={factsRef}
              className="gap-5 *:pr-5 *:last:pr-0 flex items-center justify-center divide-x-2 divide-ink/15"
            >
              <Facts facts={parts.facts} song={song} />
            </dl>
            <Actions
              context={parts.context}
              song={shownSong}
              closeButton={closeButton}
              close={() => void close()}
              picture={() => cardRef.current?.snapshot() ?? null}
              onTraded={(count) => setTraded((done) => done + count)}
            />
            <MoreBelow scroller={scrollerRef} />
          </div>
        </div>
      </div>
      <ShowcaseBelow
        shown={settled}
        below={parts.below}
        song={song}
        onRelated={onRelated}
      />
    </dialog>
  )
}

// A collection card's actions: listening and sharing, then selling copies or
// putting one up for auction either side of the close button. Selling the
// last copy closes the showcase.
function CollectionActions({
  song,
  closeButton,
  close,
  picture,
  onTraded,
}: ShowcaseActionsProps) {
  return (
    <>
      <ListenRow song={song} picture={picture} />
      {/* Wrapped: the buttons' own transitions would override the row's. */}
      <CardTrade
        song={song}
        copies={song.copies}
        onTraded={(count) => {
          onTraded(count)
          if (count >= song.copies) close()
        }}
      >
        {closeButton}
      </CardTrade>
    </>
  )
}

// What scrolls up under the showcase (`below`; the card's related cards by
// default), mounted once the card has landed so its loading costs the flight
// nothing.
function ShowcaseBelow({
  shown,
  below,
  song,
  onRelated,
}: {
  shown: boolean
  below: ReactNode
  song: CollectedSong
  onRelated: ComponentProps<typeof RelatedCards>["onOpen"]
}) {
  return (
    <div
      data-shown={shown || undefined}
      className="max-w-2xl gap-4 pt-3 pb-12 mx-auto flex flex-col opacity-0 transition-opacity duration-300 data-shown:opacity-100"
    >
      {shown
        ? (below ?? <RelatedCards song={song} onOpen={onRelated} />)
        : null}
    </div>
  )
}

// The facts under the card: the screen's own, else the song's or artist's.
function Facts({ facts, song }: { facts: ReactNode; song: CollectedSong }) {
  return facts ?? <SongFacts song={song} />
}

// Points down to what's below the card's screen.
function MoreBelow({ scroller }: { scroller: RefObject<HTMLElement | null> }) {
  return (
    <button
      type="button"
      className="flex text-ink/50 outline-none focus-visible:text-ink"
      aria-label="More below"
      onClick={() =>
        scroller.current?.scrollTo({
          top: innerHeight * 0.85,
          behavior: "smooth",
        })
      }
    >
      <ChevronDownIcon aria-hidden="true" className="size-6 animate-bounce" />
    </button>
  )
}

// A song's release day, or an artist's monthly listeners.
function SongFacts({ song }: { song: CollectedSong }) {
  return song.kind === "song" ? (
    <SongFact label="Released" value={releaseDay(song.releaseDate ?? "")} />
  ) : (
    <SongFact
      label="Monthly listeners"
      value={compact.format(song.monthlyListeners ?? 0)}
    />
  )
}

export function SongFact({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="text-center">
      <dt className="text-xs font-semibold tracking-wide text-ink/60 uppercase">
        {label}
      </dt>
      <dd className="text-xl font-black font-heading whitespace-nowrap">
        {value}
      </dd>
    </div>
  )
}
