import { Effect, Schedule, Schema } from "effect"

import type { ImportedSong } from "./validators"

const baseUrl = "https://api.audiometa.io/v1"
export const browsePageSize = 50

export class AudiometaError extends Schema.TaggedError<AudiometaError>()(
  "AudiometaError",
  { message: Schema.String, status: Schema.optional(Schema.Number) }
) {}

class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    path: string
  ) {
    super(`${status} on ${path}`)
  }
}

const Image = Schema.Struct({ url: Schema.String })
const ArtistRef = Schema.Struct({ id: Schema.String, name: Schema.String })

const AlbumRef = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  album_type: Schema.NullOr(Schema.String),
  release_date: Schema.NullOr(Schema.String),
  images: Schema.Array(Image),
  artists: Schema.Array(ArtistRef),
})

const Track = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  images: Schema.Array(Image),
  preview_url: Schema.NullOr(Schema.String),
  external_ids: Schema.Struct({ isrc: Schema.optional(Schema.String) }),
  artists: Schema.Array(ArtistRef),
  album: Schema.NullOr(AlbumRef),
  playcounts: Schema.Struct({ spotify: Schema.NullOr(Schema.Number) }),
})

const BrowsePage = Schema.Struct({
  items: Schema.Array(Schema.Struct({ id: Schema.String })),
})

const TracksResponse = Schema.Struct({
  tracks: Schema.Array(Schema.NullOr(Track)),
})

type Track = typeof Track.Type

function isRetryable(error: AudiometaError) {
  return (
    error.status === undefined || error.status === 429 || error.status >= 500
  )
}

const getJson = Effect.fn("getJson")(function* <S extends Schema.Top>(
  apiKey: string,
  path: string,
  schema: S
) {
  const body = yield* Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(`${baseUrl}${path}`, {
        signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!response.ok) {
        throw new HttpStatusError(response.status, path)
      }

      return (await response.json()) as unknown
    },
    catch: (error) =>
      new AudiometaError({
        message: error instanceof Error ? error.message : String(error),
        status: error instanceof HttpStatusError ? error.status : undefined,
      }),
  }).pipe(
    Effect.timeout("45 seconds"),
    Effect.catchTag("TimeoutError", () =>
      Effect.fail(new AudiometaError({ message: `Timed out on ${path}` }))
    ),
    Effect.retry({
      times: 6,
      schedule: Schedule.exponential("2 seconds"),
      while: isRetryable,
    })
  )

  return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
    Effect.mapError(
      (error) => new AudiometaError({ message: `${path}: ${error.message}` })
    )
  )
})

function readApiKey() {
  const apiKey = process.env.AUDIOMETA_API_KEY
  return apiKey
    ? Effect.succeed(apiKey)
    : Effect.fail(
        new AudiometaError({ message: "AUDIOMETA_API_KEY is not set" })
      )
}

function toImportedSong(track: Track, streams: number): ImportedSong {
  const album = track.album

  return {
    sourceId: track.id,
    title: track.name,
    artistIds: track.artists.map((artist) => artist.id),
    artistNames: track.artists.map((artist) => artist.name),
    imageUrl: track.images[0]?.url ?? album?.images[0]?.url,
    previewUrl: track.preview_url ?? undefined,
    isrc: track.external_ids.isrc,
    spotifyStreams: streams,
    album: album
      ? {
          sourceId: album.id,
          name: album.name,
          albumType: album.album_type ?? undefined,
          releaseDate: album.release_date ?? undefined,
          imageUrl: album.images[0]?.url,
          artistNames: album.artists.map((artist) => artist.name),
        }
      : undefined,
  }
}

export const fetchPopularityPage = Effect.fn("fetchPopularityPage")(function* (
  offset: number,
  minStreams: number
) {
  const apiKey = yield* readApiKey()
  const page = yield* getJson(
    apiKey,
    `/tracks/by-tempo?tempo_min=0&tempo_max=400&sort=popularity&order=desc&limit=${browsePageSize}&offset=${offset}`,
    BrowsePage
  )

  if (page.items.length === 0) {
    return { scanned: 0, songs: [] }
  }

  const { tracks } = yield* getJson(
    apiKey,
    `/tracks?ids=${page.items.map((item) => item.id).join(",")}`,
    TracksResponse
  )

  const songs = tracks.flatMap((track) => {
    const streams = track?.playcounts.spotify
    return track &&
      streams !== null &&
      streams !== undefined &&
      streams >= minStreams
      ? [toImportedSong(track, streams)]
      : []
  })

  return { scanned: page.items.length, songs }
})
