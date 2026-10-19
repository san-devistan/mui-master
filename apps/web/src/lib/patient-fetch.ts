// fetch for the auth calls on a phone's network: a request that can't connect, hangs, or gets a
// gateway error is tried again, backing off to every 10 s and right away once the browser is back
// online, until the auth server itself answers. Only its answers come back (2xx, or a 4xx such as
// a refused sign-in): Better Auth reads a failed session or token fetch as "signed out", and the
// game then stayed blank for good.
const RETRIED_STATUSES = new Set([408, 429, 500, 502, 503, 504])
// Long enough for a slow 3G round trip or two.
const ATTEMPT_TIMEOUT = 20_000
const MAX_DELAY = 10_000

const pause = (attempt: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      globalThis.removeEventListener?.("online", done)
      resolve()
    }
    const timer = setTimeout(done, Math.min(500 * 2 ** attempt, MAX_DELAY))
    globalThis.addEventListener?.("online", done)
  })

export const patientFetch: typeof fetch = async (input, init) => {
  const caller = init?.signal
  for (let attempt = 0; ; attempt++) {
    // Not AbortSignal.any/timeout: older iPhones don't have them.
    const controller = new AbortController()
    const abort = () => controller.abort()
    caller?.addEventListener("abort", abort)
    const timer = setTimeout(abort, ATTEMPT_TIMEOUT)
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      })
      if (!RETRIED_STATUSES.has(response.status)) return response
    } catch (error) {
      if (caller?.aborted) throw error
    } finally {
      clearTimeout(timer)
      caller?.removeEventListener("abort", abort)
    }
    await pause(attempt)
  }
}
