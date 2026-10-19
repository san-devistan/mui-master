// Shows the game's pushes (packages/backend/convex/notify.ts) and opens their page when tapped.
// It also caches the app (registered on every visit by src/lib/service-worker.ts), so the next start
// reads its files from the cache and still boots offline or when the network hangs. Auth and the
// other /api/ calls, Convex, other origins (covers, previews) and anything but GET are never cached.

// Bump when the caching below changes: activating deletes the other versions' caches.
const VERSION = "v1"
// Each page's copy to start from without the network, saved once every file it links is cached.
const PAGES = `pages-${VERSION}`
// A page's newer version (after a deploy), until a visit running it has cached its files.
const FRESH = `fresh-${VERSION}`
const ASSETS = `assets-${VERSION}`
const STATIC = `static-${VERSION}`
// A page the network takes longer to send starts from its copy...
const PAGE_TIMEOUT = 1500
// ...unless a newer version waits to be run once, so a slow network doesn't stay on the old one.
const NEW_PAGE_TIMEOUT = 10_000
// shortcut: past this many files, the oldest ones that no saved page links and the last visit didn't
// load are dropped (a font or lazy chunk then comes back on its next online use); keep a file list
// per deploy if offline starts ever miss one.
const MAX_ASSETS = 60
const STATIC_FILES = new Set([
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
])

self.addEventListener("install", () => self.skipWaiting())

// Takes over the open tabs right away, so a tap can move them to the push's page and their next
// requests go through the cache.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const current = [PAGES, FRESH, ASSETS, STATIC]
      const old = (await caches.keys()).filter(
        (name) =>
          /^(pages|fresh|assets|static)-/.test(name) && !current.includes(name)
      )
      await Promise.all(old.map((name) => caches.delete(name)))
      await self.registration.navigationPreload?.enable()
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (
    request.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/") ||
    request.headers.has("range")
  ) {
    return
  }
  if (request.mode === "navigate") event.respondWith(page(event, url))
  else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(asset(event, request))
  } else if (STATIC_FILES.has(url.pathname)) {
    event.respondWith(staticFile(event, request))
  }
})

// Sent by each page once loaded: its URL and the files it loaded (the first visit loads them before
// this worker runs).
self.addEventListener("message", (event) => {
  const urls = event.data?.cache
  if (Array.isArray(urls))
    event.waitUntil(saveVisit(urls).catch(() => undefined))
})

// The page version each path's last start is checking: its visit report, sent once it has loaded,
// can arrive before that check is done.
const noting = new Map()
const linkedFiles = (html) => html.match(/\/assets\/[^"'\s)]+/g) ?? []
const pageKey = (url) => url.origin + url.pathname

// Network first, so a deploy shows on the next start; the page's copy when the network fails, hangs
// or errors, so a flaky or offline start still boots. Each path has its own copy: the landing page
// and the game's pages differ.
async function page(event, url) {
  const network = Promise.resolve(event.preloadResponse).then(
    (preloaded) => preloaded ?? fetch(event.request)
  )
  const note = network
    .then((response) => noteVersion(url, response.clone()))
    .catch(() => undefined)
  noting.set(pageKey(url), note)
  event.waitUntil(note)
  const waiting = await caches.match(pageKey(url), { cacheName: FRESH })
  const timeout = new Promise((resolve) => {
    setTimeout(resolve, waiting ? NEW_PAGE_TIMEOUT : PAGE_TIMEOUT)
  })
  const answer = await Promise.race([network, timeout]).catch(() => undefined)
  if (answer && answer.status < 500) return answer
  const saved = await caches.match(pageKey(url), { cacheName: PAGES })
  return saved ?? answer ?? network
}

// Keeps a built page the network sent if it isn't the copy's version (a dev page links no /assets/).
async function noteVersion(url, response) {
  if (!response.ok || response.redirected || response.type !== "basic") return
  const linked = linkedFiles(await response.clone().text())
  if (linked.length === 0) return
  const copy = await caches.match(pageKey(url), { cacheName: PAGES })
  if (copy && linkedFiles(await copy.text()).join() === linked.join()) return
  await (await caches.open(FRESH)).put(pageKey(url), response)
}

// Hashed file names never change content: the cache first, the network (then cached) on a miss.
async function asset(event, request) {
  const cache = await caches.open(ASSETS)
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === "basic") {
    event.waitUntil(cache.put(request, response.clone()).catch(() => undefined))
  }
  return response
}

// The saved copy at once, and a fresh one saved for next time.
async function staticFile(event, request) {
  const cache = await caches.open(STATIC)
  const cached = await cache.match(request, { ignoreVary: true })
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone())
    return response
  })
  event.waitUntil(network.catch(() => undefined))
  return cached ?? network
}

// Caches the files the page loaded (mostly read back from the HTTP cache), then makes the page's
// newer version its copy once every file that version links is cached, so a copy always finds its
// own files. A newer version that isn't the one running waits for a start that runs it.
async function saveVisit([pageUrl, ...loaded]) {
  const url = new URL(pageUrl)
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return
  const files = new Set()
  for (const href of loaded) {
    const file = new URL(href)
    if (
      file.origin === location.origin &&
      file.pathname.startsWith("/assets/")
    ) {
      files.add(file.pathname)
    }
  }
  const assets = await caches.open(ASSETS)
  const isCached = (path) => assets.match(path, { ignoreVary: true })
  await Promise.all(
    [...files].map(async (path) => {
      if (!(await isCached(path))) await assets.add(path).catch(() => undefined)
    })
  )
  const [pages, fresh] = await Promise.all([
    caches.open(PAGES),
    caches.open(FRESH),
  ])
  const key = pageKey(url)
  await noting.get(key)
  // The first visit fetched its page before this worker ran: fetch it once more.
  const latest =
    (await fresh.match(key)) ??
    ((await pages.match(key)) ? null : await fetch(key))
  if (!latest?.ok || latest.redirected) return
  const linked = linkedFiles(await latest.clone().text())
  if (linked.length === 0) return
  if ((await Promise.all(linked.map(isCached))).includes(undefined)) return
  await pages.put(key, latest)
  await fresh.delete(key)
  await trimAssets(assets, files)
}

async function trimAssets(assets, kept) {
  const keys = await assets.keys()
  if (keys.length <= MAX_ASSETS) return
  const pages = await caches.open(PAGES)
  const saved = await Promise.all(
    (await pages.keys()).map((key) =>
      pages.match(key).then((copy) => copy?.text() ?? "")
    )
  )
  const linked = saved.join("")
  const dropped = keys.slice(0, keys.length - MAX_ASSETS).filter((key) => {
    const path = new URL(key.url).pathname
    return !kept.has(path) && !linked.includes(path)
  })
  await Promise.all(dropped.map((key) => assets.delete(key)))
}

self.addEventListener("push", (event) => {
  const message = event.data?.json()
  if (!message) return
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      // A newer bid replaces the last one's notification, and still alerts.
      renotify: true,
      icon: "/icon-192.png",
      data: message.url,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data ?? "/play"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      const open = windows[0]
      if (!open) return self.clients.openWindow(url)
      return open
        .focus()
        .then(() => open.navigate(url))
        .catch(() => self.clients.openWindow(url))
    })
  )
})
