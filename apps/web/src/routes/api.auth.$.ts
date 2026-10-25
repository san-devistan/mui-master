import { createFileRoute } from "@tanstack/react-router"

const convexSite = import.meta.env.VITE_CONVEX_SITE_URL ?? ""
// The Convex site's host, checked once at startup like the library's own handler did.
const convexHost = URL.canParse(convexSite) ? new URL(convexSite).host : ""

// The player's IP, for the backend's rate limits (convex/throttle.ts): Cloudflare gives
// this Worker's requests to Convex the Worker's own address, so the route passes the IP it got,
// signed with the AUTH_PROXY_SECRET it shares with the backend (a Worker secret here, a Convex env
// var there). Without the secret (local dev), Convex counts the request against its sender's IP.
const proxySecret = () => process.env.AUTH_PROXY_SECRET ?? ""

const passClientIp = (request: Request, upstream: Headers) => {
  upstream.delete("x-holotrack-client-ip")
  upstream.delete("x-holotrack-proxy-secret")
  const ip = request.headers.get("cf-connecting-ip")
  const secret = proxySecret()
  if (!ip || !secret) return
  upstream.set("x-holotrack-client-ip", ip)
  upstream.set("x-holotrack-proxy-secret", secret)
}

// Better Auth's endpoints, forwarded to the Convex deployment, as @convex-dev/better-auth's
// handler does, but with the body read up front: Node's fetch (undici 7.21) fails a streamed
// request body that gets a 401 back, such as a wrong password, with "expected non-null body
// source". Connection-level headers from the upstream response are dropped: HTTP/2 forbids them,
// and the local https proxy then fails every other request on the reused connection.
const forward = async (request: Request) => {
  if (!convexHost) {
    return new Response("VITE_CONVEX_SITE_URL is not set", { status: 500 })
  }
  const url = new URL(request.url)
  const proto = url.protocol.replace(/:$/, "")
  const upstream = new Headers(request.headers)
  for (const name of ["transfer-encoding", "content-length", "connection"]) {
    upstream.delete(name)
  }
  upstream.set("accept-encoding", "application/json")
  upstream.set("host", convexHost)
  upstream.set("x-forwarded-host", url.host)
  upstream.set("x-forwarded-proto", proto)
  upstream.set("x-better-auth-forwarded-host", url.host)
  upstream.set("x-better-auth-forwarded-proto", proto)
  passClientIp(request, upstream)
  const response = await fetch(`${convexSite}${url.pathname}${url.search}`, {
    method: request.method,
    headers: upstream,
    redirect: "manual",
    body: request.method === "GET" ? null : await request.arrayBuffer(),
  })
  const headers = new Headers(response.headers)
  for (const name of ["connection", "keep-alive", "transfer-encoding"]) {
    headers.delete(name)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => forward(request),
      POST: ({ request }) => forward(request),
    },
  },
})
