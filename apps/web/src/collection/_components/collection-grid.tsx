import { CardDetailDrawer } from "@/collection/_components/card-detail-drawer"
import { MusicCard } from "@/collection/_components/music-card"
import { useSongPreview } from "@/collection/_hooks/use-song-preview"
import type { CollectionFilter, SongCard } from "@/collection/_lib/card-format"
import { useConvexPaginatedQuery } from "@convex-dev/react-query"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { GameCardButton } from "@workspace/ui/components/game-card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useState } from "react"

const pageSize = 60

const filters: ReadonlyArray<{ value: CollectionFilter; label: string }> = [
  { value: "all", label: "All songs" },
  { value: "owned", label: "Owned" },
]

function isCollectionFilter(value: unknown): value is CollectionFilter {
  return filters.some((filter) => filter.value === value)
}

export function CollectionGrid({ collectorKey }: { collectorKey: string }) {
  const [filter, setFilter] = useState<CollectionFilter>("all")
  const [selected, setSelected] = useState<SongCard | null>(null)
  const preview = useSongPreview(collectorKey)
  const { results, status, loadMore } = useConvexPaginatedQuery(
    api.collection.list,
    { collectorKey, owned: filter === "owned" },
    { initialNumItems: pageSize }
  )

  return (
    <section aria-labelledby="collection-title" className="gap-3 flex flex-col">
      <div className="gap-3 sm:flex-row sm:items-center sm:justify-between flex flex-col">
        <h2
          id="collection-title"
          className="text-lg font-semibold font-heading"
        >
          Collection
        </h2>
        <Tabs
          value={filter}
          onValueChange={(next: unknown) => {
            if (isCollectionFilter(next)) {
              setFilter(next)
            }
          }}
        >
          <TabsList className="sm:w-fit w-full">
            {filters.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <ul className="gap-3 sm:grid-cols-3 lg:grid-cols-5 grid grid-cols-2">
        {results.map((card) => (
          <li key={card.id}>
            {card.copies > 0 ? (
              <GameCardButton
                aria-label={`Play ${card.title}`}
                onClick={() => {
                  setSelected(card)
                  void preview.play(card.id)
                }}
              >
                <MusicCard card={card} />
              </GameCardButton>
            ) : (
              <MusicCard card={card} isLocked />
            )}
          </li>
        ))}
        {status === "LoadingFirstPage" || status === "LoadingMore"
          ? ["one", "two", "three", "four", "five"].map((key) => (
              <li key={key}>
                <Skeleton className="aspect-5/7" />
              </li>
            ))
          : null}
      </ul>
      {status === "Exhausted" && results.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground">
          {filter === "owned"
            ? "Open a pack to start your collection."
            : "No songs imported yet."}
        </p>
      ) : null}
      {status === "CanLoadMore" ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => loadMore(pageSize)}
        >
          Load more
        </Button>
      ) : null}
      <CardDetailDrawer
        card={selected}
        previewStatus={preview.status}
        onTogglePreview={preview.toggle}
        onClose={() => {
          preview.stop()
          setSelected(null)
        }}
      />
    </section>
  )
}
