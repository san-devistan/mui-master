import {
  fadeIn,
  fadeOut,
  silentWhileHidden,
} from "@/game/_hooks/use-song-preview"
import {
  cuesBetween,
  filmCardAt,
  type FilmCue,
  filmTimeAt,
  PACK_FILM,
  PACK_POSTER,
} from "@/landing/pack-film"
import { SHOWCASE, type ShowcaseCard } from "@/landing/showcase-pack"
import { RarityBadge } from "@workspace/ui/components/rarity-badge"
import { play, soundTaps } from "@workspace/ui/lib/game/sfx"
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
  usePreview(shown === null ? undefined : SHOWCASE[shown])

  return (
    // Pulled up under the hero (drawn above it): the top of the pack peeks out
    // at the hero's foot.
    <section
      aria-labelledby="pack-story-title"
      className="relative game-pack-peek"
    >
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
            <div className="md:aspect-560/844 md:w-auto h-full w-full">
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
            </div>
          </div>
        </div>
        <ol className="pointer-events-none relative">
          {/* The chapters are just scroll length: two screens, the pack's and
              the first card's (the others take none), for the film's
              FILM_SCREENS and a beat on its last frame, then a last screen
              holding that frame before the sign-up. Their text is for screen
              readers and search, not over the pack. */}
          <Chapter step="Your pack" title="A free pack, every 8 hours">
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
          <li aria-hidden="true" className="h-dvh" />
        </ol>
      </div>
    </section>
  )
}

function Chapter({
  step,
  title,
  room = true,
  children,
}: {
  step: string
  title: string
  // A screen of scroll length; without it, only its text.
  room?: boolean
  children: ReactNode
}) {
  return (
    <li className={room ? "h-dvh" : undefined}>
      <div className="sr-only">
        <p>{step}</p>
        <h3>{title}</h3>
        <div>{children}</div>
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
    // The film time last shown: cues between it and the next play.
    let last = filmTimeAt(
      -element.getBoundingClientRect().top / scroller.clientHeight
    )
    let frame = 0
    const update = () => {
      frame = 0
      const chapter =
        -element.getBoundingClientRect().top / scroller.clientHeight
      const time = filmTimeAt(chapter)
      for (const { cue, card } of cuesBetween(last, time)) sound(cue, card)
      last = time
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

// A legendary inside opens with its light's flourish, as in the game
// (opening-scene.ts glowHold; not imported, as it pulls three.js into the
// server render).
const HAS_LEGENDARY = SHOWCASE.some((card) => card.rarity === "legendary")

// Plays a film cue as the game does: a card's reveal by its rarity, and a
// legendary's light in place of the plain opening.
function sound(cue: FilmCue["cue"], card?: number) {
  if (cue === "card") {
    const rarity = card === undefined ? undefined : SHOWCASE[card]?.rarity
    if (rarity) play(rarity)
  } else if (cue === "glow") play(HAS_LEGENDARY ? "glow" : "open")
  else play(cue)
}

// A seek still in flight is overtaken by this one; tiny moves are skipped.
function seek(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) > 1 / 60) video.currentTime = time
}

// Plays `card`'s preview while it's on show, always, with the game's fades:
// the last song fades out fully, then the next fades in, and each loops with
// a fade at its ends. Silent while the page is out of sight. A play refused
// before the visitor's first tap or key is tried again on it.
function usePreview(card: ShowcaseCard | undefined) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // The song wanted now: a quick scroll skips songs still fading.
  const wantedRef = useRef<string | null>(null)
  const url = card?.preview ?? null

  useEffect(() => {
    const unhide = silentWhileHidden(
      () => audioRef.current,
      (audio) => {
        if (wantedRef.current) void fadeIn(audio).catch(() => undefined)
      },
      () => {
        wantedRef.current = null
      }
    )
    // The game's sound starts with the first click or tap, here too.
    const untap = soundTaps()
    return () => {
      untap()
      unhide()
      if (audioRef.current) void fadeOut(audioRef.current)
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    wantedRef.current = url
    const audio = (audioRef.current ??= new Audio())
    const retry = () => {
      if (wantedRef.current === url && audio.paused) void start()
    }
    const unlisten = () => {
      for (const gesture of GESTURES) removeEventListener(gesture, retry)
    }
    async function start() {
      if (!url) return
      // The last song fades out before the next one starts.
      await fadeOut(audio)
      if (wantedRef.current !== url) return
      if (audio.src !== url) audio.src = url
      if (document.hidden) return
      try {
        await fadeIn(audio)
        unlisten()
      } catch {
        // Refused until a gesture: tried again on the next one.
      }
    }
    if (url) {
      for (const gesture of GESTURES) addEventListener(gesture, retry)
      void start()
    } else void fadeOut(audio)
    return unlisten
  }, [url])
}

// The page events that let a browser start sound: until the visitor has made
// one of them, play() is refused.
const GESTURES = ["pointerdown", "keydown", "touchend"] as const
