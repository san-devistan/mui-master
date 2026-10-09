import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import type { ImportedArtist } from "./songs/_lib/validators"

// Pairs Audiometa artist IDs with their names (both in credit order).
export function creditedArtists(
  sourceIds: ReadonlyArray<string>,
  names: ReadonlyArray<string>
): Array<ImportedArtist> {
  return sourceIds.map((sourceId, index) => ({
    sourceId,
    name: names[index] ?? "",
  }))
}

export async function upsertArtist(ctx: MutationCtx, artist: ImportedArtist) {
  const existing = await ctx.db
    .query("artists")
    .withIndex("by_sourceId", (q) => q.eq("sourceId", artist.sourceId))
    .unique()

  if (!existing) {
    return await ctx.db.insert("artists", artist)
  }
  if (existing.name !== artist.name) {
    await ctx.db.patch("artists", existing._id, { name: artist.name })
  }
  return existing._id
}

export async function upsertArtists(
  ctx: MutationCtx,
  artists: ReadonlyArray<ImportedArtist>
) {
  const ids: Array<Id<"artists">> = []
  for (const artist of artists) {
    const id = await upsertArtist(ctx, artist)
    if (!ids.includes(id)) {
      ids.push(id)
    }
  }
  return ids
}

// Sets a song's credited artists (lead first) on songs.artistIds and songArtists, dropping stale links.
export async function linkSongArtists(
  ctx: MutationCtx,
  songId: Id<"songs">,
  artists: ReadonlyArray<ImportedArtist>
) {
  const artistIds = await upsertArtists(ctx, artists)

  for (const [position, artistId] of artistIds.entries()) {
    const link = await ctx.db
      .query("songArtists")
      .withIndex("by_songId_and_artistId", (q) =>
        q.eq("songId", songId).eq("artistId", artistId)
      )
      .unique()
    if (!link) {
      await ctx.db.insert("songArtists", { songId, artistId, position })
    } else if (link.position !== position) {
      await ctx.db.patch("songArtists", link._id, { position })
    }
  }

  for (const link of await ctx.db
    .query("songArtists")
    .withIndex("by_songId_and_artistId", (q) => q.eq("songId", songId))
    .take(100)) {
    if (!artistIds.includes(link.artistId)) {
      await ctx.db.delete("songArtists", link._id)
    }
  }

  await ctx.db.patch("songs", songId, {
    artistIds,
    artistNames: artists.map((artist) => artist.name),
  })
}
