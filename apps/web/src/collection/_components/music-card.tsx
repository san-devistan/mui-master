import {
  formatArtists,
  formatStreams,
  type SongCard,
} from "@/collection/_lib/card-format"
import {
  GameCard,
  GameCardArt,
  GameCardBody,
  GameCardMeta,
  GameCardRarity,
  GameCardStat,
  GameCardStats,
  GameCardTitle,
} from "@workspace/ui/components/game-card"

type MusicCardProps = {
  card: Pick<
    SongCard,
    "title" | "artistNames" | "imageUrl" | "spotifyStreams" | "rarity"
  >
  isLocked?: boolean
}

export function MusicCard({ card, isLocked }: MusicCardProps) {
  return (
    <GameCard rarity={card.rarity} state={isLocked ? "locked" : "owned"}>
      <GameCardArt src={card.imageUrl} alt="" />
      <div className="top-2 left-2 absolute">
        <GameCardRarity rarity={card.rarity}>{card.rarity}</GameCardRarity>
      </div>
      <GameCardBody>
        <GameCardTitle>{isLocked ? "???" : card.title}</GameCardTitle>
        <GameCardMeta>
          {isLocked ? "Not collected" : formatArtists(card.artistNames)}
        </GameCardMeta>
        <GameCardStats className="grid-cols-1">
          <GameCardStat
            label="Streams"
            value={formatStreams(card.spotifyStreams)}
          />
        </GameCardStats>
      </GameCardBody>
    </GameCard>
  )
}
