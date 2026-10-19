// Tells public/sw.js the page and the files it loaded, which it caches for the next start (offline
// too): the first visit loads them before the worker runs, and lazy files load later.
const report = () =>
  navigator.serviceWorker.ready.then((registration) =>
    registration.active?.postMessage({
      cache: [
        location.href,
        ...performance.getEntriesByType("resource").map((entry) => entry.name),
      ],
    })
  )

const start = () => {
  navigator.serviceWorker
    .register("/sw.js")
    .then(report)
    .catch(() => undefined)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void report()
  })
}

// Registers public/sw.js on every visit (the profile's notification switch registers the same one),
// once the page has loaded so it doesn't compete with the game's first requests.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
  if (document.readyState === "complete") start()
  else window.addEventListener("load", start, { once: true })
}
