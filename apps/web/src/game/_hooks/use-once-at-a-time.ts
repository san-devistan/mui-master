import { useRef } from "react"

// Runs `task` unless the last one is still running: a spend button's `busy` state only disables
// it after a re-render, so quick taps in between would each pay. One tap, one purchase.
export function useOnceAtATime() {
  const runningRef = useRef(false)
  return async (task: () => Promise<void>) => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      await task()
    } finally {
      runningRef.current = false
    }
  }
}
