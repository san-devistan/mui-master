const creditPattern = /^(feat\.?|ft\.?|featuring|with)\s/i
const editionPattern =
  /\b(remaster(ed)?|radio edit|single version|original version|album version|mono|stereo|from\b|bonus track)/i
const variantPattern = /\b(remix|version|edit|mix)\b/i

function isIgnoredSuffix(suffix: string) {
  const trimmed = suffix.trim()
  return creditPattern.test(trimmed) || editionPattern.test(trimmed)
}

export function displayTitle(title: string) {
  return title
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (match, inner: string) =>
      isIgnoredSuffix(inner) ? "" : match
    )
    .replace(/\s+-\s+(.*)$/, (match, suffix: string) =>
      isIgnoredSuffix(suffix) ? "" : match
    )
    .replace(/\s{2,}/g, " ")
    .trim()
}

function canonicalTitle(title: string) {
  return displayTitle(title)
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (match, inner: string) =>
      variantPattern.test(inner) ? "" : match
    )
    .replace(/\s+-\s+(.*)$/, (match, suffix: string) =>
      variantPattern.test(suffix) ? "" : match
    )
    .trim()
}

export function songKey(title: string, leadArtistId: string) {
  const normalized = canonicalTitle(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

  return `${leadArtistId}:${normalized}`
}
