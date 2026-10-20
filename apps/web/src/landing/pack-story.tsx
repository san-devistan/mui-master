import { PlayButton } from "@/landing/play-button"
import {
  SHOWCASE,
  SHOWCASE_COVERS,
  type ShowcaseCard,
} from "@/landing/showcase-pack"
import { storyAt, type Story } from "@/landing/story"
import { RarityBadge } from "@workspace/ui/components/rarity-badge"
import {
  ChevronsDownIcon,
  ScissorsIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

// three.js only loads once the story is near: the page above paints first.
const ScrollPack = lazy(() =>
  import("@workspace/ui/components/scroll-pack").then((module) => ({
    default: module.ScrollPack,
  }))
)

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

// The game's pack opening as the page scrolls: a sticky stage beside one
// chapter per screen. Each chapter is real text, so it reads (and indexes)
// without the 3D.
export function PackStory() {
  const storyRef = useRef<HTMLDivElement>(null)
  const near = useNear(storyRef)
  const story = useStory(storyRef)
  const [sound, setSound] = useState(false)
  const onShow = story.phase === "open" ? SHOWCASE[story.index] : undefined
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
          <div className="max-w-6xl md:px-8 lg:grid-cols-2 mx-auto grid h-full">
            {/* Phones: the stage takes the screen above the caption. */}
            <div className="lg:col-start-2 lg:h-full pointer-events-auto relative h-3/5">
              {near ? (
                <Suspense fallback={null}>
                  <ScrollPack
                    cards={SHOWCASE}
                    covers={SHOWCASE_COVERS}
                    step={story}
                    sound={sound}
                  />
                </Suspense>
              ) : null}
              <SoundToggle
                on={sound}
                playing={preview}
                onChange={(on) => setSound(on)}
              />
            </div>
          </div>
        </div>
        <ol className="pointer-events-none relative">
          <Chapter step="Your pack" title="A free pack, every 8 hours">
            Scroll to open it. It holds five real cards from the biggest songs
            and artists on Spotify. Three can wait for you, so none are lost
            overnight.
            <Hint>
              <ChevronsDownIcon aria-hidden="true" className="size-5" />
              Keep scrolling
            </Hint>
          </Chapter>
          <Chapter step="The cut" title="Slice it open">
            In the game you drag your finger along the seam. The foil strip
            flies off, the pack drops away, and your cards rise out of it.
            <Hint>
              <ScissorsIcon aria-hidden="true" className="size-5" />
              Cutting…
            </Hint>
          </Chapter>
          {SHOWCASE.map((pulled, index) => (
            <CardChapter
              key={pulled.id}
              card={pulled}
              index={index}
              active={story.phase === "open" && story.index === index}
            />
          ))}
          <Chapter step="Your turn" title="That pack could be yours">
            Every pull is random, and the best card always comes last. Open your
            first real pack now, free, no sign-up.
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
  children,
}: {
  step: string
  title: string
  children: ReactNode
}) {
  return (
    <li className="max-w-6xl px-4 sm:px-6 md:px-8 lg:grid-cols-2 lg:items-center pointer-events-none mx-auto grid h-dvh items-end">
      <div className="max-w-md p-5 mb-6 lg:p-6 lg:mb-0 shadow-xl backdrop-blur-md pointer-events-auto rounded-3xl bg-card/85">
        <p className="text-sm font-bold tracking-wide text-ink/60 uppercase">
          {step}
        </p>
        <h3 className="mt-1 text-2xl font-black md:text-4xl lg:mt-2 tracking-tighter font-heading text-balance">
          {title}
        </h3>
        <div className="mt-2 text-sm lg:mt-3 lg:text-base text-pretty text-ink/75">
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
    <Chapter step={`Card ${index + 1} of ${SHOWCASE.length}`} title={name}>
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

function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="mt-4 gap-2 text-sm font-bold flex items-center text-ink/60">
      {children}
    </span>
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
      className="right-4 top-4 lg:top-8 px-4 py-2 gap-2 text-sm font-bold shadow-lg absolute z-30 flex items-center rounded-full border-2 border-ink bg-card game-safe-top"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

// The story at the page's scroll: chapters scrolled past the top of `ref`,
// in screens.
function useStory(ref: { current: HTMLElement | null }) {
  const [story, setStory] = useState<Story>(() => storyAt(0, SHOWCASE.length))
  useEffect(() => {
    const element = ref.current
    const scroller = element?.closest("[data-slot=landing-scroll]")
    if (!element || !scroller) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const chapter =
        -element.getBoundingClientRect().top / scroller.clientHeight
      const next = storyAt(chapter, SHOWCASE.length)
      setStory((was) =>
        was.phase === next.phase &&
        was.cut === next.cut &&
        was.index === next.index
          ? was
          : next
      )
    }
    const schedule = () => {
      frame ||= requestAnimationFrame(update)
    }
    update()
    scroller.addEventListener("scroll", schedule, { passive: true })
    addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      scroller.removeEventListener("scroll", schedule)
      removeEventListener("resize", schedule)
    }
  }, [ref])
  return story
}

// True once `ref` is within a screen of the view, and from then on.
function useNear(ref: { current: Element | null }) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || near) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true)
      },
      { rootMargin: "100% 0px" }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, near])
  return near
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
