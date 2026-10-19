import { storyAt, type Story } from "@/landing/story"
import type { ShowcaseCard } from "@/landing/showcase-pack"
import { Celebration } from "@workspace/ui/components/celebration"
import { GameMotes } from "@workspace/ui/components/game-motes"
import {
  mountOpeningScene,
  type OpeningScene,
} from "@workspace/ui/lib/game/opening-scene"
import { play } from "@workspace/ui/lib/game/sfx"
import { useEffect, useRef, useState, type RefObject } from "react"

type Party = { index: number; rarity: "epic" | "legendary"; key: number }

// The game's own pack opening, driven by the page's scroll instead of a finger:
// `chapters` is the story element, one screen per chapter. Reports the story as
// it moves on; plays the game's cues once sound is on.
export default function ScrollPack({
  cards,
  covers,
  chapters,
  sound,
  onStory,
}: {
  cards: ReadonlyArray<ShowcaseCard>
  covers: ReadonlyArray<string>
  chapters: RefObject<HTMLElement | null>
  sound: boolean
  onStory: (story: Story) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<OpeningScene | null>(null)
  const [story, setStory] = useState<Story>(() => storyAt(0, cards.length))
  const [party, setParty] = useState<Party | null>(null)
  const soundRef = useRef(sound)
  soundRef.current = sound
  const onStoryRef = useRef(onStory)
  onStoryRef.current = onStory

  useEffect(() => {
    const canvas = canvasRef.current
    const story = chapters.current
    const scroller = story?.closest("[data-slot=landing-scroll]")
    if (!canvas || !story || !scroller) return undefined
    const seen = new Set<number>()
    let shown: Story = storyAt(0, cards.length)
    let frame = 0
    // While the pack drops away the pile ignores `show`: once it's out, catch
    // up with however far the page scrolled meanwhile.
    const scene = mountOpeningScene(canvas, cards, covers, () => {
      if (shown.phase === "open") scene.show(shown.index, -1)
    })
    sceneRef.current = scene

    const cue = (name: Parameters<typeof play>[0]) => {
      if (soundRef.current) play(name)
    }

    const update = () => {
      frame = 0
      const { top } = story.getBoundingClientRect()
      const next = storyAt(-top / scroller.clientHeight, cards.length)
      scene.setCut(next.cut)
      if (next.phase !== shown.phase) {
        // Scrolled back above the open pack: a fresh, sealed one, so it can
        // open again.
        if (next.phase !== "open") seen.clear()
        scene.setPhase(next.phase)
        if (next.phase === "cut") cue("press")
        if (next.phase === "open") {
          cue("rip")
          cue("open")
        }
      }
      const opened = next.phase === "open" && shown.phase !== "open"
      if (next.phase === "open" && (opened || next.index !== shown.index)) {
        scene.show(next.index, next.index > shown.index ? -1 : 1)
        const card = cards[next.index]
        if (shown.phase === "open") cue("swipe")
        if (card) cue(card.rarity)
        const rarity = card?.rarity
        if ((rarity === "epic" || rarity === "legendary") && !seen.has(next.index)) {
          seen.add(next.index)
          scene.celebrate(next.index, rarity)
          setParty({ index: next.index, rarity, key: Date.now() })
        }
      }
      shown = next
      setStory(next)
      onStoryRef.current(next)
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
      sceneRef.current = null
      scene.dispose()
    }
  }, [cards, covers, chapters])

  return (
    <div
      data-slot="pack-opening"
      data-phase={story.phase}
      className="game-studio size-full"
    >
      <GameMotes />
      <canvas ref={canvasRef} className="game-canvas z-10" aria-hidden="true" />
      {story.phase === "open" && party?.index === story.index ? (
        <Celebration key={party.key} rarity={party.rarity} />
      ) : null}
    </div>
  )
}
