// Syncs the songs and artists tables (convex/catalog.ts) with DJ Salty's "100+ Million Streams"
// playlists, the catalog's source of truth. Run monthly:
// node scripts/import-songs.mjs [--save] [--prod] [--parallel=6]
// 1. Reads every track of the playlists (fetchPlaylistMetadata).
// 2. Imports the tracks not stored as a song or a song's duplicate. Per song: getTrack (name,
//    artists, count, cover, duration, explicit, release date and year), the embed page (preview),
//    audio-analysis (tempo) and Deezer for the song and artist ids: the playable track with the
//    song's ISRC, else a search (see deezerTrack). Per artist: queryArtistOverview (picture,
//    monthly listeners). Songs under 100M streams are skipped, so each run tries them again.
// 3. Refreshes every stored song's play count (getTrack) and every stored artist's monthly
//    listeners (queryArtistOverview), nothing else. A song that leaves the playlists stays.
// 4. catalog:updateRarities: each artist's playcount becomes the sum of its catalog songs', and
//    songs' and artists' rarities rise to what their playcounts give (never down).
// Writes go to the deployment in packages/backend/.env.local (dev), or to production with --prod,
// a batch of 100 at a time. Without --save it runs the first batch of each step and prints it,
// saving nothing. Exits 1 when more than 1% of the songs and artists fail, so whatever runs it
// notices.
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { deezerTrack, normalize } from "./import-songs/deezer.mjs"
import {
  getArtist,
  getTrack,
  isrc,
  largest,
  playlistTracks,
  preview,
  releaseDate,
  releaseYear,
  tempo,
} from "./import-songs/spotify.mjs"

// Spotify caps a playlist at 10,000 tracks, so DJ Salty starts a new one when one fills up: add
// its URL here.
const playlists = [
  "https://open.spotify.com/playlist/0nwC4WbX0wGfH1Asj185R6",
  "https://open.spotify.com/playlist/0rc9QKRjVxJQDt6CO77X4n",
]

const args = process.argv.slice(2)
const save = args.includes("--save")
const prod = args.includes("--prod")
const parallel = Number(
  args.find((arg) => arg.startsWith("--parallel="))?.slice(11) ?? 6
)
const minPlaycount = 100_000_000
const batchSize = 100

const importSong = async (trackId) => {
  const track = await getTrack(trackId)
  if (!track || Number(track.playcount) < minPlaycount) return null
  const credits = [...track.firstArtist.items, ...track.otherArtists.items]
  const durationMs = track.duration.totalMilliseconds
  const code = await isrc(trackId)
  const deezer = await deezerTrack(
    code,
    track.name,
    credits.map((credit) => credit.profile.name),
    durationMs
  )
  const deezerArtist = new Map(
    (deezer?.contributors ?? []).map((c) => [normalize(c.name), String(c.id)])
  )
  return {
    song: {
      name: track.name,
      ids: { spotify: trackId, deezer: deezer?.id ?? null, isrc: code },
      artists: credits.map((credit) => credit.id),
      playcount: Number(track.playcount),
      image: largest(track.albumOfTrack.coverArt.sources),
      preview: await preview(trackId),
      metadata: {
        tempo: await tempo(trackId),
        durationMs,
        explicit: track.contentRating.label === "EXPLICIT",
        releaseYear: releaseYear(track.albumOfTrack.date),
        releaseDate: releaseDate(track.albumOfTrack.date),
      },
    },
    artists: credits.map((credit) => ({
      name: credit.profile.name,
      ids: {
        spotify: credit.id,
        deezer: deezerArtist.get(normalize(credit.profile.name)) ?? null,
      },
    })),
  }
}

const importArtist = async (artist) => {
  const overview = await getArtist(artist.ids.spotify)
  return {
    ...artist,
    image: largest(overview.visuals?.avatarImage?.sources),
    monthlyListeners: overview.stats?.monthlyListeners ?? null,
  }
}

// A stored song's play count, or null when Spotify no longer serves the track: it's kept as is.
const songPlaycount = async (spotifyId) => {
  const track = await getTrack(spotifyId)
  const playcount = Number(track?.playcount)
  return track && playcount > 0 ? { spotify: spotifyId, playcount } : null
}

const artistListeners = async (spotifyId) => {
  const monthlyListeners = (await getArtist(spotifyId))?.stats?.monthlyListeners
  return typeof monthlyListeners === "number"
    ? { spotify: spotifyId, monthlyListeners }
    : null
}

const run = promisify(execFile)
const convex = async (fn, fnArgs) => {
  const { stdout } = await run(
    "pnpm",
    [
      "exec",
      "convex",
      "run",
      ...(prod ? ["--prod"] : []),
      fn,
      JSON.stringify(fnArgs),
    ],
    { cwd: new URL("../packages/backend", import.meta.url), maxBuffer: 1e8 }
  )
  return JSON.parse(stdout || "null")
}

const mapLimit = async (items, fn) => {
  const results = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]).catch((error) => ({ error }))
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker))
  return results
}

// Every row of a paginated catalog query.
const readAll = async (fn) => {
  const rows = []
  let cursor = null
  for (;;) {
    const result = await convex(fn, {
      paginationOpts: { numItems: 2000, cursor },
    })
    for (const row of result.page) rows.push(row)
    if (result.isDone) return rows
    cursor = result.continueCursor
  }
}

const logErrors = (ids, results) => {
  for (const [index, result] of results.entries()) {
    if (result?.error) {
      console.log("error  ", ids[index], result.error.message.slice(0, 160))
    }
  }
  return results.filter((result) => result?.error).length
}

const progress = (step, { done, total, totals, startedAt }) => {
  const minutes = (Date.now() - startedAt) / 60_000
  console.log(
    `-- ${step} ${done}/${total}`,
    totals,
    `${(done / minutes).toFixed(0)}/min`
  )
}

// Step 2: full import of tracks not stored yet.
const importNew = async (trackIds) => {
  const totals = { saved: 0, under100M: 0, rejected: 0, errors: 0 }
  const startedAt = Date.now()
  for (let start = 0; start < trackIds.length; start += batchSize) {
    const batch = trackIds.slice(start, start + batchSize)
    const results = await mapLimit(batch, importSong)
    totals.errors += logErrors(batch, results)
    totals.under100M += results.filter((result) => !result).length
    const found = results.filter((result) => result?.song)
    const songs = found.map((result) => result.song)
    const artists = new Map()
    for (const artist of found.flatMap((result) => result.artists)) {
      // A Deezer id found on any song wins over a song where the artist wasn't matched.
      if (!artists.get(artist.ids.spotify)?.ids.deezer) {
        artists.set(artist.ids.spotify, artist)
      }
    }
    const artistRows = (
      await mapLimit([...artists.values()], importArtist)
    ).filter((artist) => !artist.error)
    // Songs whose artist overview failed wait for the next run.
    const saved = new Set(artistRows.map((artist) => artist.ids.spotify))
    const ready = songs.filter((song) =>
      song.artists.every((id) => saved.has(id))
    )
    totals.errors += songs.length - ready.length
    if (!save) {
      console.table(
        ready.map((song) => ({
          name: song.name.slice(0, 28),
          playcount: song.playcount,
          deezer: song.ids.deezer,
          preview: Boolean(song.preview),
          ...song.metadata,
        }))
      )
      return totals
    }
    if (ready.length) {
      // catalog:save applies the catalog's rules and returns the songs it rejected.
      const rejected = await convex("catalog:save", {
        artists: artistRows.filter((artist) =>
          ready.some((song) => song.artists.includes(artist.ids.spotify))
        ),
        songs: ready,
      })
      for (const id of rejected)
        console.log("skip   ", id, "fails the catalog rules")
      totals.rejected += rejected.length
      totals.saved += ready.length - rejected.length
    }
    progress("import", {
      done: Math.min(start + batchSize, trackIds.length),
      total: trackIds.length,
      totals,
      startedAt,
    })
  }
  return totals
}

// Step 3: play counts and monthly listeners of everything stored.
const refreshStored = async (songIds, artistIds) => {
  const totals = { songs: 0, artists: 0, gone: 0, errors: 0 }
  const startedAt = Date.now()
  const total = songIds.length + artistIds.length
  const ids = [
    ...songIds.map((id) => ({ id, song: true })),
    ...artistIds.map((id) => ({ id, song: false })),
  ]
  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize)
    const results = await mapLimit(batch, ({ id, song }) =>
      song ? songPlaycount(id) : artistListeners(id)
    )
    totals.errors += logErrors(
      batch.map(({ id }) => id),
      results
    )
    totals.gone += results.filter((result) => result === null).length
    const ok = results.filter((result) => result && !result.error)
    const songs = ok.filter((result) => "playcount" in result)
    const artists = ok.filter((result) => "monthlyListeners" in result)
    if (!save) {
      console.table([...songs, ...artists])
      return totals
    }
    await convex("catalog:refresh", { songs, artists })
    totals.songs += songs.length
    totals.artists += artists.length
    progress("refresh", {
      done: Math.min(start + batchSize, total),
      total,
      totals,
      startedAt,
    })
  }
  return totals
}

const trackIds = []
for (const url of playlists) {
  const ids = await playlistTracks(url)
  console.log(`${ids.length} tracks in ${url}`)
  for (const id of ids) trackIds.push(id)
}
const stored = await readAll("catalog:storedSongs")
const known = new Set(
  stored.flatMap((song) => [song.spotify, ...song.duplicates])
)
const added = [...new Set(trackIds)].filter((id) => !known.has(id))
console.log(
  `${stored.length} songs stored, ${added.length} playlist tracks to import`
)
const imported = await importNew(added)
// Songs stored before this run: the ones just imported already have fresh counts. Artists are
// read again, so the new ones are refreshed too (a cheap call each).
const songIds = stored.map((song) => song.spotify)
const artistIds = (await readAll("catalog:storedArtists")).map(
  (artist) => artist.spotify
)
const refreshed = await refreshStored(songIds, artistIds)
const rarities = save ? await convex("catalog:updateRarities", {}) : null
console.log("import", imported, "refresh", refreshed, "rarities", rarities)

// shortcut: 1% is a guess at the usual noise (1 error in 19,979 on 2026-10-12); a broken hash or
// token fails nearly everything, well above it.
const attempted = added.length + songIds.length + artistIds.length
const errors = imported.errors + refreshed.errors
if (save && errors > attempted / 100) {
  console.error(`${errors} errors of ${attempted}: check the log`)
  process.exitCode = 1
}
