import { MusicCard } from "@/collection/_components/music-card"
import type { PulledCard } from "@/collection/_lib/card-format"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { GameCardReveal } from "@workspace/ui/components/game-card"
import { SparklesIcon } from "lucide-react"

type PackRevealProps = {
  pulls: ReadonlyArray<PulledCard>
  onDone: () => void
}

export function PackReveal({ pulls, onDone }: PackRevealProps) {
  return (
    <section aria-label="Pack results" className="gap-4 flex flex-col">
      <div className="gap-2 flex items-center justify-between">
        <h2 className="gap-2 text-lg font-semibold flex items-center font-heading">
          <SparklesIcon className="size-5" aria-hidden="true" />
          Pack opened
        </h2>
        <Button variant="outline" size="sm" onClick={onDone}>
          Back to collection
        </Button>
      </div>
      <ul className="gap-3 sm:grid-cols-3 md:grid-cols-5 grid grid-cols-2">
        {pulls.map((card) => (
          <GameCardReveal key={card.pullId}>
            <MusicCard card={card} />
            {card.isNew ? (
              <div className="top-2 right-2 absolute">
                <Badge>New</Badge>
              </div>
            ) : null}
          </GameCardReveal>
        ))}
      </ul>
    </section>
  )
}
