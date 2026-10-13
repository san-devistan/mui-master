export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Retries rate limits and outages; anything else fails the song.
export const fetchOk = async (url, init) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, init).catch((error) => ({ error }))
    if (res.ok) return res
    const retry = res.error || res.status === 429 || res.status >= 500
    if (attempt === 5 || !retry) {
      throw new Error(`${res.status ?? res.error} on ${url}`)
    }
    await sleep(1000 * 2 ** attempt)
  }
}
