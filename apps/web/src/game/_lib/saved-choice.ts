import { useState } from "react"

// A choice (a filter or an order) kept in localStorage under `key`, so it's
// still there after a reload. A stored value not in `allowed` (e.g. an option
// since renamed) falls back to `fallback`, as does a render without storage
// (the server's).
export function useSavedChoice<Value extends string>(
  key: string,
  allowed: ReadonlyArray<Value>,
  fallback: Value
) {
  const [value, setValue] = useState<Value>(() => {
    if (typeof window === "undefined") return fallback
    const stored = window.localStorage.getItem(`holotrack:${key}`)
    return allowed.find((option) => option === stored) ?? fallback
  })
  const save = (next: Value) => {
    setValue(next)
    try {
      localStorage.setItem(`holotrack:${key}`, next)
    } catch {
      // Storage full or blocked (private mode): the choice still holds until a reload.
    }
  }
  return [value, save] as const
}
