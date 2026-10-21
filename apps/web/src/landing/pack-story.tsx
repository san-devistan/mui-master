import {
  filmCardAt,
  filmTimeAt,
  PACK_FILM,
  PACK_POSTER,
} from "@/landing/pack-film"
import { PlayButton } from "@/landing/play-button"
import { SHOWCASE, type ShowcaseCard } from "@/landing/showcase-pack"
import { RarityBadge } from "@workspace/ui/components/rarity-badge"
import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

// The game's pack opening as the page scrolls: a sticky, centred film of it
// with its chapters scrolling up under it. Each chapter is real text, so it
// reads (and indexes) without the film.
export function PackStory() {
  const storyRef = useRef<HTMLDivElement>(null)
  const filmRef = useRef<HTMLVideoElement>(null)
  const shown = useFilmScroll(storyRef, filmRef)
  const [sound, setSound] = useState(false)
  const onShow = shown === null ? undefined : SHOWCASE[shown]
  const preview = usePreview(sound ? onShow : undefined)

  return (
    <section aria-labelledby="pack-story-title" className="relative">
      <h2 id="pack-story-title" className="sr-only">
        Open a pack
      </h2>
      {/* Stage and chapters share one grid cell: the chapters set its height,
          and the stage sticks to the screen while they scroll past. */}
      <div ref={storyRef} className="grid *:col-start-1 *:row-start-1">
        <div className="top-0 pointer-events-none sticky h-dvh">
          <div className="flex h-full justify-center">
            {/* The game's own opening: the whole screen on phones, a
                frame a little wider than a phone on bigger screens, so the
                pack is the size it is in the game. The film's sky fades out
                at its edges into the page's own. */}
            <div className="md:aspect-560/844 md:w-auto pointer-events-auto relative h-full w-full">
              <video
                ref={filmRef}
                src={PACK_FILM}
                poster={PACK_POSTER}
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
                className="md:mask-x-from-84% size-full mask-t-from-85% mask-b-from-92% object-cover"
              />
              <SoundToggle
                on={sound}
                playing={preview}
                onChange={(on) => setSound(on)}
              />
            </div>
          </div>
        </div>
        <ol className="pointer-events-none relative">
          {/* While the pack opens, its chapters are just scroll length: two
              screens, the pack's and the first card's (the others take
              none), for the film's FILM_SCREENS and a beat on its last
              frame. Their text is for screen readers and search, not over
              the pack. */}
          <Chapter step="Your pack" title="A free pack, every 8 hours" hidden>
            Scroll to slice it open: in the game you drag your finger along the
            seam. Three packs can wait for you, so none are lost overnight.
          </Chapter>
          {SHOWCASE.map((pulled, index) => (
            <CardChapter
              key={pulled.id}
              card={pulled}
              index={index}
              active={shown === index}
            />
          ))}
          <Chapter step="Your turn" title="That pack could be yours">
            Every pull is random. A real pack holds five cards, and one in 1,000
            is a god pack: five legendaries. Open yours now, free, no sign-up.
            <div className="mt-6 pointer-events-auto">
              <PlayButton>Open my first pack</PlayButton>
            </div>
          </Chapter>
        </ol>
      </div>
    </section>
  )
}

function Chapter({
  step,
  title,
  hidden = false,
  room = true,
  children,
}: {
  step: string
  title: string
  // Kept for its scroll length and for screen readers, but not shown.
  hidden?: boolean
  // A screen of scroll length; without it, only its text.
  room?: boolean
  children: ReactNode
}) {
  return (
    <li
      className={`px-4 sm:px-6 pointer-events-none flex items-end justify-center ${room ? "h-dvh" : ""}`}
    >
      <div
        className={
          hidden
            ? "sr-only"
            : "max-w-md p-5 mb-6 lg:p-6 lg:mb-8 shadow-xl backdrop-blur-md pointer-events-auto w-full rounded-3xl bg-card/85 text-center"
        }
      >
        <p className="text-sm font-bold tracking-wide text-ink/60 uppercase">
          {step}
        </p>
        <h3 className="mt-1 text-2xl font-black md:text-4xl lg:mt-2 tracking-tighter font-heading text-balance">
          {title}
        </h3>
        <div className="mt-2 text-sm lg:mt-3 lg:text-base text-pretty text-ink/75 *:justify-center">
          {children}
        </div>
      </div>
    </li>
  )
}

function CardChapter({
  card,
  index,
  active,
}: {
  card: ShowcaseCard
  index: number
  active: boolean
}) {
  const name =
    card.kind === "artist" ? card.title : `${card.title}, ${card.artist}`
  return (
    <Chapter
      step={`Card ${index + 1} of ${SHOWCASE.length}`}
      title={name}
      hidden
      room={index === 0}
    >
      <span className="gap-3 mb-3 flex items-center">
        <RarityBadge rarity={card.rarity} />
        <span className="font-black font-heading">
          {compact.format(card.streams)} streams
        </span>
      </span>
      {card.blurb}
      {active ? <span className="sr-only">On show now.</span> : null}
    </Chapter>
  )
}

function SoundToggle({
  on,
  playing,
  onChange,
}: {
  on: boolean
  playing: boolean
  onChange: (on: boolean) => void
}) {
  const Icon = on ? Volume2Icon : VolumeXIcon
  let label = "Hear the cards"
  if (on) label = playing ? "Playing the pull" : "Sound on"
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className="bottom-2 px-4 py-2 gap-2 text-sm font-bold shadow-lg absolute left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full border-2 border-ink bg-card"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

// Scrubs `film` to the page's scroll, screens scrolled past the top of `ref`;
// returns the card on show. Each frame only seeks, so a fling or a jump just
// shows a later (or, scrolling up, earlier) frame.
function useFilmScroll(
  ref: { current: HTMLElement | null },
  film: { current: HTMLVideoElement | null }
) {
  const [shown, setShown] = useState<number | null>(null)
  useEffect(() => {
    const element = ref.current
    const video = film.current
    const scroller = element?.closest("[data-slot=landing-scroll]")
    if (!element || !video || !scroller) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const chapter =
        -element.getBoundingClientRect().top / scroller.clientHeight
      const time = filmTimeAt(chapter)
      seek(video, time)
      setShown(filmCardAt(time))
    }
    const schedule = () => {
      frame ||= requestAnimationFrame(update)
    }
    update()
    scroller.addEventListener("scroll", schedule, { passive: true })
    addEventListener("resize", schedule)
    // The first seek can come before the video knows its length.
    video.addEventListener("loadedmetadata", schedule)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener("scroll", schedule)
      removeEventListener("resize", schedule)
      video.removeEventListener("loadedmetadata", schedule)
    }
  }, [ref, film])
  return shown
}

// A seek still in flight is overtaken by this one; tiny moves are skipped.
function seek(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) > 1 / 60) video.currentTime = time
}

// Plays `card`'s preview while it's on show (and sound is on), fading it in.
// True while one plays.
function usePreview(card: ShowcaseCard | undefined) {
  const [playing, setPlaying] = useState(false)
  const url = card?.preview
  useEffect(() => {
    if (!url) return undefined
    const audio = new Audio(url)
    audio.loop = true
    audio.volume = 0
    let fade = 0
    // A newer card (or sound off) took over: don't touch state for this one.
    let stopped = false
    const step = () => {
      audio.volume = Math.min(audio.volume + 0.04, 0.7)
      if (audio.volume < 0.7) fade = requestAnimationFrame(step)
    }
    async function start() {
      try {
        await audio.play()
        if (stopped) return
        setPlaying(true)
        fade = requestAnimationFrame(step)
      } catch {
        if (!stopped) setPlaying(false)
      }
    }
    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(fade)
      audio.pause()
      setPlaying(false)
    }
  }, [url])
  return playing
}
