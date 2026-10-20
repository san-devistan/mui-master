import { toGameCard } from "@/game/_lib/cards"
import type { CollectedSong } from "@/game/_lib/collection"
import { convexQuery } from "@convex-dev/react-query"
import { useQueries, useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { Marquee } from "@workspace/ui/components/marquee"
import {
  SongCardThumb,
  songCardThumbSlot,
} from "@workspace/ui/components/song-card"
import type { CardSlot } from "@workspace/ui/lib/game/card-scene"
import { usePaginatedQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  memo,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"

// Cards in a row, and how many more a row loads as it nears its end.
const ROW = 12

type Related = FunctionReturnType<typeof api.related.artists>[number]
// Opens a card the player owns, flying from its thumb (`opener`, its button).
type OnOpen = (
  song: CollectedSong,
  from: CardSlot | undefined,
  opener: HTMLButtonElement
) => void

// Under the showcased card: what's related to it. An artist: their songs and
// the artists they're featured with. A song: its artists, then each one's other
// songs. Owned cards open; the rest show grayed out and don't react.
export function RelatedCards({
  song,
  onOpen: open,
}: {
  song: CollectedSong
  onOpen: OnOpen
}) {
  // The same function every render, so the memoized cards don't redraw when
  // the page above them does.
  const latest = useRef(open)
  useEffect(() => {
    latest.current = open
  })
  const [onOpen] = useState(() => {
    const stable: OnOpen = (card, from, opener) =>
      latest.current(card, from, opener)
    return stable
  })
  if (song.kind === "artist") {
    return <ArtistRelated artistId={song.id} onOpen={onOpen} />
  }
  return <SongRelated song={song} onOpen={onOpen} />
}

function ArtistRelated({
  artistId: id,
  onOpen,
  title = "Discography",
}: {
  artistId: string
  onOpen: OnOpen
  title?: string
}) {
  const { data: circle } = useQuery(
    convexQuery(api.related.artistCircle, { artistId: id })
  )
  return (
    <>
      <ArtistSongs
        artistId={id}
        title={title}
        count={circle?.songs}
        onOpen={onOpen}
      />
      {circle?.collaborators.length ? (
        <ArtistRow
          title="Featured with"
          ids={circle.collaborators}
          count={{
            owned: circle.collaboratorsOwned,
            total: circle.collaborators.length,
          }}
          onOpen={onOpen}
        />
      ) : null}
    </>
  )
}

// A song's artists, then each one's other songs.
function SongRelated({
  song,
  onOpen,
}: {
  song: CollectedSong
  onOpen: OnOpen
}) {
  const { data: artists } = useQuery(
    convexQuery(api.related.songArtists, { songId: song.id })
  )
  if (!artists) return null
  return (
    <>
      <ArtistRow
        title={artists.length > 1 ? "Artists" : "Artist"}
        ids={artists}
        onOpen={onOpen}
      />
      {artists.map((id) => (
        <ArtistSongsBy
          key={id}
          artistId={id}
          row={artists.slice(0, ROW)}
          skip={song.id}
          onOpen={onOpen}
        />
      ))}
    </>
  )
}

// "More from <artist>": their songs, less the one showcased (`skip`, which the
// player owns: it's out on show).
function ArtistSongsBy({
  artistId: id,
  row,
  skip,
  onOpen,
}: {
  artistId: Id<"artists">
  row: ReadonlyArray<Id<"artists">>
  skip: string
  onOpen: OnOpen
}) {
  // Its card comes from the Artists row's first query, so the title adds no
  // query of its own; past a row of artists, it asks for its own.
  const inRow = row.includes(id)
  const { data: artists } = useQuery(
    convexQuery(api.related.artists, { ids: inRow ? [...row] : [id] })
  )
  const artist = artists?.filter((card) => card.id === id)
  // Only the song counts are shown here, not who the artist works with.
  const { data: circle } = useQuery(
    convexQuery(api.related.artistCircle, { artistId: id, songsOnly: true })
  )
  // Only the showcased song: nothing more to show.
  if (!artist?.[0] || (circle && circle.songs.total < 2)) return null
  return (
    <ArtistSongs
      artistId={id}
      title={`More from ${artist[0].title}`}
      count={
        circle && {
          owned: circle.songs.owned - 1,
          total: circle.songs.total - 1,
        }
      }
      skip={skip}
      onOpen={onOpen}
    />
  )
}

function ArtistSongs({
  artistId: id,
  title,
  count,
  skip,
  onOpen,
}: {
  artistId: string
  title: string
  count?: { owned: number; total: number }
  skip?: string
  onOpen: OnOpen
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.related.artistSongs,
    { artistId: id },
    { initialNumItems: ROW }
  )
  return (
    <RelatedRow
      title={title}
      count={count}
      cards={results.filter((card) => card.id !== skip)}
      more={status === "CanLoadMore" ? () => loadMore(ROW) : null}
      loading={status === "LoadingFirstPage"}
      onOpen={onOpen}
    />
  )
}

// Artists by id, a row's worth at a time: each "more" asks for the next ids
// only, and the row joins the pages in.
function ArtistRow({
  title,
  ids,
  count,
  onOpen,
}: {
  title: string
  ids: ReadonlyArray<Id<"artists">>
  count?: { owned: number; total: number }
  onOpen: OnOpen
}) {
  const [pages, setPages] = useState(1)
  const chunks = Array.from(
    { length: Math.ceil(ids.length / ROW) },
    (_, page) => ids.slice(page * ROW, (page + 1) * ROW)
  )
  const results = useQueries({
    queries: chunks
      .slice(0, pages)
      .map((chunk) => convexQuery(api.related.artists, { ids: chunk })),
  })
  // Pages in so far, in order, up to the first still loading: while the next
  // ones load, the row keeps what it has.
  const loaded = results.findIndex((result) => !result.data)
  const ready = loaded === -1 ? results : results.slice(0, loaded)
  const cards = ready.flatMap((result) => result.data ?? [])
  return (
    <RelatedRow
      title={title}
      count={count}
      cards={cards}
      more={
        pages < chunks.length && loaded === -1
          ? () => setPages((page) => page + 1)
          : null
      }
      loading={loaded === 0}
      onOpen={onOpen}
    />
  )
}

// One section: its title and how many of its cards the player owns, over a
// row of cards that scrolls sideways and loads more as it nears its end.
function RelatedRow({
  title,
  count,
  cards,
  more,
  loading,
  onOpen,
}: {
  title: string
  count?: { owned: number; total: number }
  cards: ReadonlyArray<Related>
  more: (() => void) | null
  loading: boolean
  onOpen: OnOpen
}) {
  if (!loading && !cards.length) return null
  return (
    <section className="gap-1 flex flex-col">
      <header className="px-5 gap-3 flex items-baseline justify-between">
        {/* One line: a title too long to sit beside the count scrolls round. */}
        <h2 className="min-w-0 text-lg font-black font-heading">
          <Marquee>{title}</Marquee>
        </h2>
        {count ? (
          <span
            className="text-sm font-semibold shrink-0 text-ink/60 tabular-nums"
            aria-label={`${count.owned} of ${count.total} collected`}
          >
            {count.owned}/{count.total}
          </span>
        ) : null}
      </header>
      {/* Sideways only, and only once its cards overflow the width; room
          above and below for a card's lift, so it never scrolls up and down.
          A vertical swipe on it scrolls the page. */}
      <ul
        data-slot="card-row"
        className="px-5 gap-3 py-2 scroll-px-5 game-no-scrollbar flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {cards.map((card) => (
          <RelatedCard key={card.id} card={card} onOpen={onOpen} />
        ))}
        {/* Remounted as each page comes in, so it looks again. */}
        {loading || more ? (
          <MoreInRow key={cards.length} onNear={more} />
        ) : null}
      </ul>
    </section>
  )
}

// Memoized, like the collection's cards: a page coming in renders only its own.
const RelatedCard = memo(function RelatedCard({
  card,
  onOpen,
}: {
  card: Related
  onOpen: OnOpen
}) {
  const song = useMemo(() => toGameCard(card), [card])
  const owned = card.copies > 0
  const label =
    song.kind === "artist" ? song.title : `${song.title} by ${song.artist}`
  return (
    // Clipped just outside the card: the thumb's canvas runs past it for the
    // 3D stage's margins, and would make the row scroll up and down.
    <li className="w-28 sm:w-32 shrink-0 snap-start game-thumb-clip">
      <button
        type="button"
        disabled={!owned}
        className="group/card @container relative block w-full rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-default"
        aria-label={
          owned ? `${label}, ${song.rarity}` : `${label}, not collected yet`
        }
        onClick={(event) =>
          onOpen(
            song,
            songCardThumbSlot(event.currentTarget) ?? undefined,
            event.currentTarget
          )
        }
      >
        <SongCardThumb song={song} copies={card.copies} muted={!owned} />
      </button>
    </li>
  )
})

// A card-sized placeholder at a row's end; near the view, it asks for more.
function MoreInRow({ onNear }: { onNear: (() => void) | null }) {
  const ref = useRef<HTMLLIElement>(null)
  const near = useEffectEvent(() => onNear?.())

  useEffect(() => {
    const item = ref.current
    if (!item || !onNear) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) near()
      },
      { root: item.parentElement, rootMargin: "0px 100%" }
    )
    observer.observe(item)
    return () => observer.disconnect()
  }, [onNear])

  return (
    <li
      ref={ref}
      aria-hidden="true"
      className="w-28 sm:w-32 animate-pulse aspect-5/7 shrink-0 rounded-2xl bg-muted"
    />
  )
}
