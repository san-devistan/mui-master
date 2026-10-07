import { useSyncExternalStore } from "react"

const storageKey = "musi-master.collector-key"

function readOrCreateCollectorKey() {
  const existing = window.localStorage.getItem(storageKey)
  if (existing) {
    return existing
  }

  const created = crypto.randomUUID()
  window.localStorage.setItem(storageKey, created)
  return created
}

function subscribe() {
  return () => undefined
}

function getServerSnapshot() {
  return null
}

export function useCollectorKey() {
  return useSyncExternalStore(
    subscribe,
    readOrCreateCollectorKey,
    getServerSnapshot
  )
}
