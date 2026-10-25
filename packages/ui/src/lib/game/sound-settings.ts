// The player's sound choices on this device: the game's sound effects (sfx.ts) and its music
// (song previews and the pack's waiting music). Both on until turned off; kept in localStorage,
// or for the visit when storage is blocked.
export type SoundKind = "sfx" | "music"

const choices = new Map<SoundKind, boolean>()
const listeners = new Set<() => void>()

export function soundOn(kind: SoundKind) {
  const chosen = choices.get(kind)
  if (chosen !== undefined) return chosen
  try {
    return localStorage.getItem(`holotrack:${kind}`) !== "off"
  } catch {
    // No storage (the server, or blocked): on.
    return true
  }
}

export function setSoundOn(kind: SoundKind, on: boolean) {
  choices.set(kind, on)
  try {
    localStorage.setItem(`holotrack:${kind}`, on ? "on" : "off")
  } catch {
    // Storage full or blocked (private mode): the choice holds until a reload.
  }
  for (const listener of listeners) listener()
}

// Calls `listener` whenever a choice changes; returns the unsubscribe.
export function onSoundChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
