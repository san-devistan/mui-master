import { Effect, Schema } from "effect"

export class DeezerError extends Schema.TaggedError<DeezerError>()(
  "DeezerError",
  { message: Schema.String }
) {}

const TrackResponse = Schema.Struct({
  preview: Schema.optional(Schema.NullOr(Schema.String)),
})

export const fetchDeezerPreview = Effect.fn("fetchDeezerPreview")(function* (
  isrc: string
) {
  const body = yield* Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(
        `https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`,
        { signal }
      )
      return (await response.json()) as unknown
    },
    catch: (error) =>
      new DeezerError({
        message: error instanceof Error ? error.message : String(error),
      }),
  }).pipe(
    Effect.timeout("8 seconds"),
    Effect.catchTag("TimeoutError", () =>
      Effect.fail(new DeezerError({ message: "Deezer timed out" }))
    )
  )

  const track = yield* Schema.decodeUnknownEffect(TrackResponse)(body).pipe(
    Effect.mapError((error) => new DeezerError({ message: error.message }))
  )
  return track.preview || null
})
