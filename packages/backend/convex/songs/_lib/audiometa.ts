import { Effect, Schedule, Schema } from "effect"

import type {
  AlbumDetails,
  ArtistDetails,
  ImportedArtist,
  ImportedSong,
} from "./validators"

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

const OptionalNumber = Schema.optional(Schema.NullOr(Schema.Number))
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

const AudioFeatures = Schema.Struct({
  tempo: OptionalNumber,
  key: OptionalNumber,
  mode: OptionalNumber,
  energy: OptionalNumber,
  danceability: OptionalNumber,
  valence: OptionalNumber,
  loudness: OptionalNumber,
  time_signature: OptionalNumber,
})

const Track = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  images: Schema.Array(Image),
  preview_url: Schema.NullOr(Schema.String),
  duration_ms: OptionalNumber,
  explicit: Schema.optional(Schema.NullOr(Schema.Boolean)),
  popularity: OptionalNumber,
  disc_number: OptionalNumber,
  track_number: OptionalNumber,
  external_ids: Schema.Struct({ isrc: Schema.optional(Schema.String) }),
  external_urls: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  artists: Schema.Array(ArtistRef),
  album: Schema.NullOr(AlbumRef),
  playcounts: Schema.Struct({
    spotify: Schema.NullOr(Schema.Number),
    youtube: OptionalNumber,
    soundcloud: OptionalNumber,
  }),
  audio_features: Schema.optional(Schema.NullOr(AudioFeatures)),
})

const BrowsePage = Schema.Struct({
  items: Schema.Array(Schema.Struct({ id: Schema.String })),
})

const TracksResponse = Schema.Struct({
  tracks: Schema.Array(Schema.NullOr(Track)),
})

const NullableNumber = Schema.optional(Schema.NullOr(Schema.Number))
const NullableString = Schema.optional(Schema.NullOr(Schema.String))
const Urls = Schema.optional(Schema.Record(Schema.String, Schema.String))

const Artist = Schema.Struct({
  ...ArtistRef.fields,
  images: Schema.Array(Image),
  popularity: NullableNumber,
  genres: Schema.Array(Schema.String),
  country_code: NullableString,
  bio: NullableString,
  external_urls: Urls,
  followers: Schema.optional(
    Schema.NullOr(Schema.Struct({ total: NullableNumber }))
  ),
  stats: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        spotify_monthly_listeners: NullableNumber,
        youtube_subscribers: NullableNumber,
        instagram_followers: NullableNumber,
        tiktok_followers: NullableNumber,
      })
    )
  ),
})

const Album = Schema.Struct({
  ...AlbumRef.fields,
  total_tracks: NullableNumber,
  release_date_precision: NullableString,
  label: NullableString,
  upc: NullableString,
  popularity: NullableNumber,
  external_urls: Urls,
})

const ArtistsResponse = Schema.Struct({
  artists: Schema.Array(Schema.NullOr(Artist)),
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

// AUDIOMETA_API_KEY holds one key or a comma-separated list (one per worker).
function apiKeys() {
  return (process.env.AUDIOMETA_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
}

export function apiKeyCount() {
  return Math.max(1, apiKeys().length)
}

function readApiKey(index: number) {
  const keys = apiKeys()
  const apiKey = keys[index % apiKeyCount()]
  return apiKey
    ? Effect.succeed(apiKey)
    : Effect.fail(
        new AudiometaError({ message: "AUDIOMETA_API_KEY is not set" })
      )
}

function opt<T>(value: T | null | undefined) {
  return value ?? undefined
}

const noFeatures: typeof AudioFeatures.Type = {}

function toDetails(track: Track) {
  const features = track.audio_features ?? noFeatures
  return {
    youtubePlays: opt(track.playcounts.youtube),
    soundcloudPlays: opt(track.playcounts.soundcloud),
    durationMs: opt(track.duration_ms),
    explicit: opt(track.explicit),
    popularity: opt(track.popularity),
    discNumber: opt(track.disc_number),
    trackNumber: opt(track.track_number),
    musicalKey: opt(features.key),
    mode: opt(features.mode),
    energy: opt(features.energy),
    danceability: opt(features.danceability),
    valence: opt(features.valence),
    loudness: opt(features.loudness),
    timeSignature: opt(features.time_signature),
    externalUrls: track.external_urls,
  }
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
    bpm: track.audio_features?.tempo ?? undefined,
    details: toDetails(track),
    album: album
      ? {
          sourceId: album.id,
          name: album.name,
          albumType: album.album_type ?? undefined,
          releaseDate: album.release_date ?? undefined,
          imageUrl: album.images[0]?.url,
          artistNames: album.artists.map((artist) => artist.name),
          artistIds: album.artists.map((artist) => artist.id),
        }
      : undefined,
  }
}

const fetchTempoRange = Effect.fn("fetchTempoRange")(function* (
  keyIndex: number,
  tempoRange: string,
  offset: number,
  minStreams: number
) {
  const apiKey = yield* readApiKey(keyIndex)
  const page = yield* getJson(
    apiKey,
    `/tracks/by-tempo?${tempoRange}&sort=popularity&order=desc&limit=${browsePageSize}&offset=${offset}`,
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

export function fetchPopularityPage(offset: number, minStreams: number) {
  return fetchTempoRange(0, "tempo_min=0&tempo_max=400", offset, minStreams)
}

// One 1-BPM bucket: no endpoint lists the catalog, and buckets keep offsets
// shallow (~12k max) instead of paging 376k tracks deep.
export function fetchBpmPage(
  keyIndex: number,
  bpm: number,
  offset: number,
  minStreams: number
) {
  return fetchTempoRange(
    keyIndex,
    `tempo_min=${bpm}&tempo_max=${bpm}.9999`,
    offset,
    minStreams
  )
}

// IDs per step: /tracks and /artists take 50 IDs per request; albums are fetched one by one
// because /albums?ids= takes 20-120 s per call while /albums/{id} answers in under a second.
export const idBatchSize = { tracks: 50, artists: 50, albums: 10 } as const

// Credited artists of stored tracks, in order (lead first), keyed by track ID.
export const fetchTrackArtists = Effect.fn("fetchTrackArtists")(function* (
  keyIndex: number,
  trackIds: ReadonlyArray<string>
) {
  const apiKey = yield* readApiKey(keyIndex)
  const { tracks } = yield* getJson(
    apiKey,
    `/tracks?ids=${trackIds.join(",")}`,
    TracksResponse
  )
  return tracks.flatMap((track) =>
    track
      ? [
          {
            trackId: track.id,
            artists: track.artists.map(
              (artist): ImportedArtist => ({
                sourceId: artist.id,
                name: artist.name,
              })
            ),
          },
        ]
      : []
  )
})

export const fetchArtists = Effect.fn("fetchArtists")(function* (
  keyIndex: number,
  artistIds: ReadonlyArray<string>
) {
  const apiKey = yield* readApiKey(keyIndex)
  const { artists } = yield* getJson(
    apiKey,
    `/artists?ids=${artistIds.join(",")}`,
    ArtistsResponse
  )
  return artists.flatMap((artist) =>
    artist
      ? [
          {
            sourceId: artist.id,
            name: artist.name,
            details: {
              imageUrl: artist.images[0]?.url,
              popularity: opt(artist.popularity),
              genres: [...artist.genres],
              countryCode: opt(artist.country_code),
              bio: opt(artist.bio),
              spotifyUrl: artist.external_urls?.spotify,
              followers: opt(artist.followers?.total),
              monthlyListeners: opt(artist.stats?.spotify_monthly_listeners),
              youtubeSubscribers: opt(artist.stats?.youtube_subscribers),
              instagramFollowers: opt(artist.stats?.instagram_followers),
              tiktokFollowers: opt(artist.stats?.tiktok_followers),
            } satisfies ArtistDetails,
          },
        ]
      : []
  )
})

export const fetchAlbums = Effect.fn("fetchAlbums")(function* (
  keyIndex: number,
  albumIds: ReadonlyArray<string>
) {
  const apiKey = yield* readApiKey(keyIndex)
  const albums = yield* Effect.forEach(
    albumIds,
    (albumId) =>
      getJson(apiKey, `/albums/${albumId}`, Album).pipe(
        // A removed album is skipped, not a failed batch.
        Effect.catchIf(
          (error) => error.status === 404,
          () => Effect.succeed(null)
        )
      ),
    { concurrency: 5 }
  )
  return albums.flatMap((album) =>
    album
      ? [
          {
            sourceId: album.id,
            name: album.name,
            albumType: opt(album.album_type),
            releaseDate: opt(album.release_date),
            imageUrl: album.images[0]?.url,
            artistNames: album.artists.map((artist) => artist.name),
            artistIds: album.artists.map((artist) => artist.id),
            details: {
              releaseDatePrecision: opt(album.release_date_precision),
              totalTracks: opt(album.total_tracks),
              label: opt(album.label),
              upc: opt(album.upc),
              popularity: opt(album.popularity),
              spotifyUrl: album.external_urls?.spotify,
            } satisfies AlbumDetails,
          },
        ]
      : []
  )
})
