import type { ConvexReactClient } from "convex/react"

// Convex backs off up to 16 s between reconnects and only skips the wait on the browser's
// `online` event, which phones don't fire when the app comes back from the background or the
// network merely recovers. Brought back on screen, or tapped, with the socket down: reconnect
// now. That call isn't public, so it's looked up; if a convex upgrade moves it, this does nothing.
// shortcut: reaches into convex's WebSocketManager, recheck after a convex upgrade.
export function reconnectOnResume(client: ConvexReactClient | undefined) {
  if (!client) return
  const retry = () => {
    if (document.visibilityState !== "visible") return
    if (client.connectionState().isWebSocketConnected) return
    const sync: unknown = Reflect.get(client, "sync")
    const manager: unknown =
      typeof sync === "object" && sync && Reflect.get(sync, "webSocketManager")
    const reconnect: unknown =
      typeof manager === "object" &&
      manager &&
      Reflect.get(manager, "tryReconnectImmediately")
    if (typeof reconnect === "function") reconnect.call(manager)
  }
  document.addEventListener("visibilitychange", retry)
  window.addEventListener("pageshow", retry)
  window.addEventListener("pointerdown", retry, { passive: true })
}
