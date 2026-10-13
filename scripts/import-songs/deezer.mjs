// The song's Deezer track, matched from its Spotify ISRC, title, artists and duration.
import assert from "node:assert/strict"

import { fetchOk, sleep } from "./http.mjs"

// Names and titles compared without accents, case, punctuation, "the" or "&"/"and": "JAŸ-Z" is
// Deezer's "JAY Z", "The Jackson 5" its "Jackson 5".
export const normalize = (text) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bthe\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
// Drops "(feat. ...)", "[...]" and "- Remastered" style suffixes for the Deezer search.
const searchTitle = (title) =>
  title
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .trim()
// Words in a title's suffix that make it another recording ("Original Mix" is the original), so
// a remix, live take or acoustic version never stands in for the song.
const versionWords = new Set(
  "acoustic cover demo instrumental karaoke live mix remix reverb session sessions slowed sped spotify stripped take".split(
    " "
  )
)
const words = (text) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
const versions = (title) => {
  const base = new Set(words(searchTitle(title)))
  const all = words(title)
  const marks = all.filter(
    (word, at) =>
      versionWords.has(word) &&
      !base.has(word) &&
      !(word === "mix" && all[at - 1] === "original")
  )
  return [...new Set(marks)].toSorted((a, b) => a.localeCompare(b)).join(" ")
}

assert.equal(
  searchTitle("Dance To This (feat. Ariana Grande)"),
  "Dance To This"
)
assert.equal(normalize("JAŸ-Z"), normalize("JAY Z"))
assert.equal(
  normalize("Echo & the Bunnymen"),
  normalize("Echo and the Bunnymen")
)
for (const [title, want] of [
  ["Danza Kuduro 2019 (Luigi Ramirez Mix)", "mix"],
  ["Mammoth - Original Mix", ""],
  ["Nothing Arrived - Live from Spotify London", "live spotify"],
  ["Yokaze - From THE FIRST TAKE", "take"],
  ["Shake Ya Tailfeather (Radio Edit)", ""],
  ["Live Forever", ""],
]) {
  assert.equal(versions(title), want, `versions(${title})`)
}
assert.equal(
  searchTitle("Half The World Away - Remastered"),
  "Half The World Away"
)

// Deezer answers its quota errors (code 4) with HTTP 200 and an error body, so they're retried
// here; otherwise a throttled search would look like "no match". Other errors ("no data") throw.
const deezerJson = async (url) => {
  for (let attempt = 1; ; attempt++) {
    const body = await (await fetchOk(url)).json()
    if (!body.error) return body
    if (body.error.code !== 4 || attempt === 5) {
      throw new Error(`Deezer ${JSON.stringify(body.error)} on ${url}`)
    }
    await sleep(2000 * attempt)
  }
}

// The playable Deezer track of the song, with its contributors, best first:
// 1. the track with the song's ISRC;
// 2. a search result with the same ISRC: Deezer often has the ISRC's own track unplayable while
//    another release of the recording plays ("Save Tonight");
// 3. a search result by the lead artist with a duration within 3 s;
// 4. one crediting any of the song's artists, as lead or contributor (Deezer can list a featured
//    artist as lead, "Thunderclouds" is LSD there, or "Various Artists" with the real ones as
//    contributors), with the same title, within 10 s, and not another version of it (a remix,
//    live or acoustic take), so "Danza Kuduro 2019 (Luigi Ramirez Mix)" never matches.
const playable = (track) => track && !track.error && track.readable !== false
export const deezerTrack = async (code, title, artists, durationMs) => {
  const found = async (id) => {
    const full = await deezerJson(`https://api.deezer.com/track/${id}`)
    return { id: String(id), contributors: full.contributors ?? [] }
  }
  const byIsrc = await deezerJson(
    `https://api.deezer.com/track/isrc:${code}`
  ).catch(() => null)
  if (playable(byIsrc)) {
    return { id: String(byIsrc.id), contributors: byIsrc.contributors ?? [] }
  }
  const lead = normalize(artists[0])
  const credited = new Set(artists.map(normalize))
  const wanted = normalize(searchTitle(title))
  const version = versions(title)
  const results = new Map()
  for (const q of [
    `artist:"${artists[0]}" track:"${searchTitle(title)}"`,
    `${artists[0]} ${searchTitle(title)}`,
    // Deezer can file the lead under another name ("Dimitri Vegas", "Various Artists").
    `track:"${searchTitle(title)}"`,
  ]) {
    const res = await deezerJson(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=15`
    )
    for (const track of res.data ?? []) results.set(track.id, track)
  }
  const tracks = [...results.values()].filter(playable)
  const off = (track) => Math.abs(track.duration * 1000 - durationMs)
  const sameIsrc = []
  for (const track of tracks) {
    const full = await deezerJson(`https://api.deezer.com/track/${track.id}`)
    if (full.isrc === code && playable(full)) sameIsrc.push(full)
  }
  if (sameIsrc[0]) {
    return {
      id: String(sameIsrc[0].id),
      contributors: sameIsrc[0].contributors ?? [],
    }
  }
  const byLead = tracks.find(
    (track) => off(track) <= 3000 && normalize(track.artist.name) === lead
  )
  if (byLead) return found(byLead.id)
  for (const track of tracks
    .filter(
      (candidate) =>
        off(candidate) <= 10_000 &&
        normalize(searchTitle(candidate.title)) === wanted &&
        versions(candidate.title) === version
    )
    .toSorted((a, b) => off(a) - off(b))) {
    const full = await found(track.id)
    const names = [track.artist.name, ...full.contributors.map((c) => c.name)]
    if (names.some((name) => credited.has(normalize(name)))) return full
  }
  return null
}
