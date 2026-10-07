import { MusicCard } from "@/collection/_components/music-card"
import { PreviewControl } from "@/collection/_components/preview-control"
import type { PreviewStatus } from "@/collection/_hooks/use-song-preview"
import {
  formatArtists,
  formatFullStreams,
  type SongCard,
} from "@/collection/_lib/card-format"
import { Badge } from "@workspace/ui/components/badge"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

type CardDetailDrawerProps = {
  card: SongCard | null
  previewStatus: PreviewStatus
  onTogglePreview: () => void
  onClose: () => void
}

export function CardDetailDrawer({
  card,
  previewStatus,
  onTogglePreview,
  onClose,
}: CardDetailDrawerProps) {
  return (
    <Drawer
      open={card !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      showSwipeHandle
    >
      <DrawerContent>
        {card ? (
          <div className="gap-4 pb-6 flex flex-col overflow-y-auto">
            <DrawerHeader>
              <DrawerTitle>{card.title}</DrawerTitle>
              <DrawerDescription>
                {formatArtists(card.artistNames)}
              </DrawerDescription>
            </DrawerHeader>
            <div className="w-48 mx-auto">
              <MusicCard card={card} />
            </div>
            <PreviewControl status={previewStatus} onToggle={onTogglePreview} />
            <div className="gap-2 px-4 flex flex-wrap justify-center">
              <Badge variant="secondary">
                {formatFullStreams(card.spotifyStreams)}
              </Badge>
              <Badge>×{card.copies}</Badge>
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}
