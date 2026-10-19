// Inlined at the top of the page (routes/__root.tsx), before the app's own scripts: when one
// they need fails to download on a flaky network (an entry file, a preload, a lazy chunk), nothing
// runs and the screen stays blank, so this reloads the page. Right away, then after 2, 10 and 30 s;
// past that, and whenever offline, once the network is back, the app is on screen again or the
// player taps. Reloads are counted for 10 minutes in sessionStorage so this never loops fast.
// Self-contained: it's serialised with toString(), so it can't use anything from outside.
export function bootRecovery() {
  const key = "boot-recovery"
  const delays = [0, 2000, 10_000, 30_000]
  const window10Min = 600_000
  let failed = false
  const recentReloads = (): Array<number> => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]")
      return Array.isArray(saved)
        ? saved.filter(
            (at): at is number =>
              typeof at === "number" && Date.now() - at < window10Min
          )
        : []
    } catch {
      return []
    }
  }
  const reload = () => {
    if (!navigator.onLine) return
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify([...recentReloads(), Date.now()])
      )
    } catch {
      // Private mode without storage: the delays still apply within this page.
    }
    location.reload()
  }
  const fail = () => {
    if (failed) return
    failed = true
    const delay = delays[recentReloads().length]
    if (delay !== undefined) setTimeout(reload, delay)
    const retry = () => {
      if (document.visibilityState === "visible") reload()
    }
    addEventListener("online", retry)
    document.addEventListener("visibilitychange", retry)
    addEventListener("pointerdown", retry)
  }
  // Chromium, Safari and Firefox wording for a lazy import that failed to download.
  const importFailed =
    /dynamically imported module|Importing a module script failed|error loading dynamically imported/i
  // A module script, preload or stylesheet of this site that failed (error events don't bubble,
  // so this listens in the capture phase). `src` and `href` read back as absolute URLs. A module
  // whose own lazy import failed reports it here too, as an uncaught error.
  const site = `${location.origin}/`
  addEventListener(
    "error",
    (event) => {
      const element = event.target
      if (element instanceof HTMLScriptElement) {
        if (element.type === "module" && element.src.startsWith(site)) fail()
      } else if (element instanceof HTMLLinkElement) {
        if (
          (element.rel === "modulepreload" || element.rel === "stylesheet") &&
          element.href.startsWith(site)
        ) {
          fail()
        }
      } else if (
        event instanceof ErrorEvent &&
        importFailed.test(event.message)
      ) {
        fail()
      }
    },
    true
  )
  // Vite's lazy imports report a failed chunk here.
  addEventListener("vite:preloadError", fail)
  // Any other lazy import that failed and that nothing caught.
  addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    if (importFailed.test(message)) fail()
  })
}
