// Spotify's web player API, read with the anonymous token its embed page carries (no API key).
import assert from "node:assert/strict"

import { fetchOk } from "./http.mjs"

// shortcut: hashes copied from open.spotify.com on 2026-10-11; on PersistedQueryNotFound,
// copy the new ones from the getTrack / queryArtistOverview / fetchPlaylistMetadata requests
// in devtools.
const hashes = {
  getTrack: "a8ef9e9f02b836feb0da3003c31dbb30decc6f4b473ef89ca88c882386d668de",
  queryArtistOverview:
    "9f8134ef565e78621f1e1793555bd6633c5ac144ae0f89604ed3ae3f80b3c8e6",
  fetchPlaylistMetadata:
    "8964e8eafb21aa992a7d951d256d83285c04be2105d209262901de70cb97584a",
}

// "2019-11-29T00:00:00Z" + DAY -> "2019-11-29"; YEAR -> "2019".
export const releaseDate = ({ isoString, precision }) =>
  precision === "DAY" ? isoString.slice(0, 10) : isoString.slice(0, 4)
// "2019-11-29T00:00:00Z" -> 2019, whatever the precision Spotify gives.
export const releaseYear = ({ isoString }) => Number(isoString.slice(0, 4))
// The widest image.
export const largest = (sources) =>
  (sources ?? []).toSorted((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
  null
// "https://open.spotify.com/playlist/{id}?si=..." -> "{id}".
export const playlistId = (url) => new URL(url).pathname.split("/").at(-1)

assert.equal(
  playlistId("https://open.spotify.com/playlist/0nwC4WbX0wGfH1Asj185R6?si=a1"),
  "0nwC4WbX0wGfH1Asj185R6"
)
assert.equal(
  releaseDate({ isoString: "2019-11-29T00:00:00Z", precision: "DAY" }),
  "2019-11-29"
)
assert.equal(
  releaseDate({ isoString: "2002-01-01T00:00:00Z", precision: "YEAR" }),
  "2002"
)
assert.equal(releaseYear({ isoString: "2019-11-29T00:00:00Z" }), 2019)
assert.equal(releaseYear({ isoString: "2002-01-01T00:00:00Z" }), 2002)
assert.equal(
  largest([
    { url: "s", width: 64 },
    { url: "l", width: 640 },
  ]),
  "l"
)

// Spotify track id (base 62) as the hex gid its metadata endpoint takes.
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const gid = (trackId) =>
  [...trackId]
    .reduce((n, char) => n * 62n + BigInt(BASE62.indexOf(char)), 0n)
    .toString(16)
    .padStart(32, "0")

assert.equal(gid("3PzsbWSQdLCKDLxn7YZfkM").length, 32)
assert.equal(gid("0000000000000000000001"), "0".repeat(31) + "1")

// The embed page carries an anonymous token valid ~15 minutes.
let token
const spotifyToken = async () => {
  if (token && token.expiresAt - Date.now() > 60_000) return token.value
  const html = await (
    await fetchOk("https://open.spotify.com/embed/track/0VjIjW4GlUZAMYd2vXMi3b")
  ).text()
  token = {
    value: html.match(/"accessToken":"([^"]+)"/)?.[1],
    expiresAt: Number(
      html.match(/"accessTokenExpirationTimestampMs":(\d+)/)?.[1]
    ),
  }
  assert.ok(token.value && token.expiresAt, "no Spotify token")
  return token.value
}

const spotify = async (operationName, variables) => {
  const res = await fetchOk(
    "https://api-partner.spotify.com/pathfinder/v2/query",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await spotifyToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        variables,
        operationName,
        extensions: {
          persistedQuery: { version: 1, sha256Hash: hashes[operationName] },
        },
      }),
    }
  )
  const body = await res.json()
  if (body.errors) throw new Error(JSON.stringify(body.errors).slice(0, 200))
  return body.data
}

export const preview = async (trackId) => {
  const html = await (
    await fetchOk(`https://open.spotify.com/embed/track/${trackId}`)
  ).text()
  return html.match(/"audioPreview":\{"url":"([^"]+)"/)?.[1] ?? null
}

export const getTrack = async (trackId) =>
  (
    await spotify("getTrack", {
      uri: `spotify:track:${trackId}`,
      includeVideoAssociationItems: false,
    })
  ).trackUnion

export const getArtist = async (artistId) =>
  (
    await spotify("queryArtistOverview", {
      uri: `spotify:artist:${artistId}`,
      locale: "",
      preReleaseV2: false,
    })
  ).artistUnion

// Every track id of a playlist, 100 a page. A slot that isn't a track Spotify serves (an episode,
// a removed track) has no track uri and is left out.
export const playlistTracks = async (url) => {
  const page = async (offset) =>
    (
      await spotify("fetchPlaylistMetadata", {
        uri: `spotify:playlist:${playlistId(url)}`,
        offset,
        limit: 100,
        enableWatchFeedEntrypoint: false,
      })
    ).playlistV2.content
  const first = await page(0)
  const ids = []
  let read = 0
  for (let offset = 0; offset < first.totalCount; offset += 100) {
    const { items } = offset ? await page(offset) : first
    read += items.length
    for (const item of items) {
      const id = item.itemV2?.data?.uri?.match(
        /^spotify:track:([A-Za-z0-9]{22})$/
      )?.[1]
      if (id) ids.push(id)
    }
  }
  // A short page would silently skip new songs.
  assert.equal(read, first.totalCount, `read ${read} tracks of ${url}`)
  return ids
}

// Tempo from Spotify's audio analysis, normalized to 50-200 BPM for the game. Spotify often reads
// half or double time, so a tempo under 50 is doubled and one over 200 halved. A song with no
// analysis (404) or a 0 tempo gets a random 50-200 BPM; other errors retry (fetchOk) or throw,
// so a rate limit never fakes one.
const randomTempo = () => 50 + Math.floor(Math.random() * 151)
const normalizeTempo = (bpm) => {
  if (!(bpm > 0)) return randomTempo()
  let value = bpm
  while (value < 50) value *= 2
  while (value > 200) value /= 2
  return Math.min(200, Math.max(50, Math.round(value)))
}
export const tempo = async (trackId) => {
  const url = `https://spclient.wg.spotify.com/audio-attributes/v1/audio-analysis/${trackId}`
  const res = await fetchOk(url, {
    headers: { authorization: `Bearer ${await spotifyToken()}` },
  }).catch((error) => {
    if (error.message.startsWith("404 ")) return null
    throw error
  })
  return normalizeTempo(res ? (await res.json()).track?.tempo : null)
}

for (const [raw, want] of [
  [44, 88],
  [24.6, 98],
  [206, 103],
  [400.6, 100],
  [399, 200],
  [138.083, 138],
  [49.9, 100],
  [200.4, 100],
]) {
  assert.equal(normalizeTempo(raw), want, `normalizeTempo(${raw})`)
}
for (const raw of [0, null, undefined, Number.NaN, ...Array(1000).fill(0)]) {
  const bpm = normalizeTempo(raw)
  assert.ok(
    Number.isInteger(bpm) && bpm >= 50 && bpm <= 200,
    `bad tempo ${bpm}`
  )
}

// The recording's ISRC from Spotify's track metadata. Throws when it's missing, so the song
// counts as an error and is retried on the next run instead of being saved without one.
export const isrc = async (trackId) => {
  const res = await fetchOk(
    `https://spclient.wg.spotify.com/metadata/4/track/${gid(trackId)}?market=from_token`,
    {
      headers: {
        authorization: `Bearer ${await spotifyToken()}`,
        accept: "application/json",
      },
    }
  )
  const ids = (await res.json()).external_id ?? []
  const code = ids.find((id) => id.type === "isrc")?.id
  assert.ok(code, `no ISRC for ${trackId}`)
  return code
}
