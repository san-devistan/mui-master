import handler from "@tanstack/react-start/server-entry"

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

// The Worker: TanStack Start, plus the landing's film served in byte ranges.
// Cloudflare's static assets answer a Range request with the whole file, and
// Chrome then can't seek a video at all: the scroll-scrubbed film stayed on its
// first frame. wrangler.jsonc sends the film here first (run_worker_first).
export default {
  fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname.endsWith(".mp4")) {
      return serveInRanges(request, env.ASSETS)
    }
    return handler.fetch(request)
  },
}

async function serveInRanges(request: Request, assets: Env["ASSETS"]) {
  const whole = new Request(request)
  whole.headers.delete("range")
  const asset = await assets.fetch(whole)
  const range = request.headers.get("range")
  const ifRange = request.headers.get("if-range")
  const headers = new Headers(asset.headers)
  headers.set("accept-ranges", "bytes")
  const stale = ifRange !== null && ifRange !== asset.headers.get("etag")
  if (!range || stale || asset.status !== 200 || request.method !== "GET") {
    return new Response(asset.body, { status: asset.status, headers })
  }
  const body = await asset.arrayBuffer()
  const span = spanOf(range, body.byteLength)
  if (span === "whole") return new Response(body, { headers })
  headers.delete("content-length")
  if (span === "past-end") {
    headers.set("content-range", `bytes */${body.byteLength}`)
    return new Response(null, { status: 416, headers })
  }
  const [start, end] = span
  headers.set("content-range", `bytes ${start}-${end}/${body.byteLength}`)
  return new Response(body.slice(start, end + 1), { status: 206, headers })
}

// The bytes a Range header asks for, first and last included: the whole file
// for anything but one valid byte range (as servers may), "past-end" when it
// starts beyond the file.
function spanOf(range: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (!match || (!match[1] && !match[2])) return "whole"
  const [, from, to] = match
  if (from && to && Number(to) < Number(from)) return "whole"
  const start = from ? Number(from) : Math.max(size - Number(to), 0)
  const end = from && to ? Math.min(Number(to), size - 1) : size - 1
  if (start >= size) return "past-end"
  return [start, end] as const
}
