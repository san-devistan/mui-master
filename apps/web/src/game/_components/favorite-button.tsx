import type { CollectedSong } from "@/game/_lib/collection"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { useMutation } from "convex/react"
import { HeartIcon } from "lucide-react"

// Marks the showcased card a favorite, or not. Shows the saved state live, and flips at once on a
// tap (the saved one takes over as the backend answers).
export function FavoriteButton({ song }: { song: CollectedSong }) {
  const { data: saved } = useQuery(
    convexQuery(api.collection.isFavorite, { cardId: song.id })
  )
  const setFavorite = useMutation(
    api.collection.setFavorite
  ).withOptimisticUpdate((store, { cardId, favorite }) => {
    store.setQuery(api.collection.isFavorite, { cardId }, favorite)
  })
  const favorite = saved ?? song.favorite ?? false

  return (
    <Button
      variant="game"
      size="icon-game"
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      onClick={() =>
        void setFavorite({ cardId: song.id, favorite: !favorite }).catch(
          () => undefined
        )
      }
    >
      <HeartIcon
        aria-hidden="true"
        data-favorite={favorite || undefined}
        className="transition-colors data-favorite:fill-current"
      />
    </Button>
  )
}
