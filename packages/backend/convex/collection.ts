import { paginationOptsValidator } from "convex/server"
import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { drawRarity, minSpotifyStreams, rarityOrder } from "./songs/_lib/rarity"
import type { SongRarity } from "./songs/_lib/validators"

const packSize = 5
const collectorKey = v.string()

function assertCollectorKey(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) {
    throw new ConvexError("Invalid collector key")
  }
}

function toSongCard(song: Doc<"songs">, copies: number) {
  return {
    id: song._id,
    title: song.title,
    artistNames: song.artistNames,
    imageUrl: song.imageUrl,
    spotifyStreams: song.spotifyStreams,
    rarity: song.rarity ?? "common",
    copies,
  }
}

async function ownedCopies(
  ctx: QueryCtx,
  key: string,
  songIds: ReadonlyArray<Id<"songs">>
) {
  const entries = await Promise.all(
    songIds.map((songId) =>
      ctx.db
        .query("ownedSongs")
        .withIndex("by_collectorId_and_songId", (q) =>
          q.eq("collectorId", key).eq("songId", songId)
        )
        .unique()
    )
  )

  return new Map(
    entries.flatMap((entry) => (entry ? [[entry.songId, entry.copies]] : []))
  )
}

async function rarityCounts(ctx: QueryCtx) {
  const counters = await ctx.db.query("rarityCounters").take(rarityOrder.length)
  return new Map(counters.map((counter) => [counter.rarity, counter.count]))
}

export const summary = query({
  args: { collectorKey },
  handler: async (ctx, args) => {
    assertCollectorKey(args.collectorKey)

    const [counts, collector] = await Promise.all([
      rarityCounts(ctx),
      ctx.db
        .query("collectors")
        .withIndex("by_collectorId", (q) =>
          q.eq("collectorId", args.collectorKey)
        )
        .unique(),
    ])

    return {
      totalSongs: [...counts.values()].reduce((sum, count) => sum + count, 0),
      ownedSongs: collector?.uniqueSongs ?? 0,
      packsOpened: collector?.packsOpened ?? 0,
    }
  },
})

export const list = query({
  args: {
    collectorKey,
    owned: v.boolean(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    assertCollectorKey(args.collectorKey)

    if (args.owned) {
      const page = await ctx.db
        .query("ownedSongs")
        .withIndex("by_collectorId", (q) =>
          q.eq("collectorId", args.collectorKey)
        )
        .order("desc")
        .paginate(args.paginationOpts)
      const songs = await Promise.all(
        page.page.map((entry) => ctx.db.get("songs", entry.songId))
      )

      return {
        ...page,
        page: page.page.flatMap((entry, index) => {
          const song = songs[index]
          return song ? [toSongCard(song, entry.copies)] : []
        }),
      }
    }

    const page = await ctx.db
      .query("songs")
      .withIndex("by_spotifyStreams", (q) =>
        q.gte("spotifyStreams", minSpotifyStreams)
      )
      .order("desc")
      .paginate(args.paginationOpts)
    const copies = await ownedCopies(
      ctx,
      args.collectorKey,
      page.page.map((song) => song._id)
    )

    return {
      ...page,
      page: page.page.map((song) =>
        toSongCard(song, copies.get(song._id) ?? 0)
      ),
    }
  },
})

async function drawSong(ctx: MutationCtx, rarity: SongRarity) {
  const pivot = Math.random()
  const above = await ctx.db
    .query("songs")
    .withIndex("by_rarity_and_randomKey", (q) =>
      q.eq("rarity", rarity).gte("randomKey", pivot)
    )
    .first()

  return (
    above ??
    (await ctx.db
      .query("songs")
      .withIndex("by_rarity_and_randomKey", (q) => q.eq("rarity", rarity))
      .first())
  )
}

function availableRarity(
  counts: ReadonlyMap<SongRarity, number>,
  roll: number
) {
  const drawn = drawRarity(roll)
  if ((counts.get(drawn) ?? 0) > 0) {
    return drawn
  }

  return rarityOrder
    .toReversed()
    .find((rarity) => (counts.get(rarity) ?? 0) > 0)
}

async function addCopy(ctx: MutationCtx, key: string, songId: Id<"songs">) {
  const entry = await ctx.db
    .query("ownedSongs")
    .withIndex("by_collectorId_and_songId", (q) =>
      q.eq("collectorId", key).eq("songId", songId)
    )
    .unique()

  if (entry) {
    const copies = entry.copies + 1
    await ctx.db.patch("ownedSongs", entry._id, { copies })
    return copies
  }

  await ctx.db.insert("ownedSongs", { collectorId: key, songId, copies: 1 })
  return 1
}

async function recordPack(ctx: MutationCtx, key: string, newSongs: number) {
  const collector = await ctx.db
    .query("collectors")
    .withIndex("by_collectorId", (q) => q.eq("collectorId", key))
    .unique()

  if (collector) {
    await ctx.db.patch("collectors", collector._id, {
      packsOpened: collector.packsOpened + 1,
      uniqueSongs: (collector.uniqueSongs ?? 0) + newSongs,
    })
  } else {
    await ctx.db.insert("collectors", {
      collectorId: key,
      packsOpened: 1,
      uniqueSongs: newSongs,
    })
  }
}

export const openPack = mutation({
  args: { collectorKey },
  handler: async (ctx, args) => {
    assertCollectorKey(args.collectorKey)

    const counts = await rarityCounts(ctx)
    const pulls = []

    for (let slot = 0; slot < packSize; slot += 1) {
      const rarity = availableRarity(counts, Math.random())
      const song = rarity ? await drawSong(ctx, rarity) : null
      if (!song) {
        throw new ConvexError(
          "The song catalog is empty. Run the import first."
        )
      }

      const copies = await addCopy(ctx, args.collectorKey, song._id)
      pulls.push({
        ...toSongCard(song, copies),
        isNew: copies === 1,
        pullId: `${song._id}-${String(slot)}`,
      })
    }

    await recordPack(
      ctx,
      args.collectorKey,
      pulls.filter((pull) => pull.isNew).length
    )
    return pulls
  },
})
