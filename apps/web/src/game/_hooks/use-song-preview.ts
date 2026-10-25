import { api } from "@workspace/backend/api"
import { onSoundChange, soundOn } from "@workspace/ui/lib/game/sound-settings"
import { useConvex } from "convex/react"
import { useEffect, useRef } from "react"

// Previews never start or stop dead: they fade in and out over this.
export const PREVIEW_FADE = 0.4
export const PREVIEW_VOLUME = 0.8

// The fade running on each element, so a new one takes over from the last.
type Fade = {
  timer: ReturnType<typeof setTimeout> | undefined
  settle: (done: boolean) => void
}
const fades = new WeakMap<HTMLAudioElement, Fade>()

// Stops the fade running on `audio`, if any.
function stopFade(audio: HTMLAudioElement) {
  fades.get(audio)?.settle(false)
}

// Eases `audio`'s volume to `to` over PREVIEW_FADE. Resolves true once there,
// false if another fade took over first. On timers, not frames: frames stop in
// a background tab, which would leave a fade (and the pause after it) stuck.
function fadeAudio(audio: HTMLAudioElement, to: number) {
  stopFade(audio)
  return new Promise<boolean>((resolve) => {
    const from = audio.volume
    const start = performance.now()
    const fade: Fade = {
      timer: undefined,
      settle(done) {
        clearTimeout(fade.timer)
        if (fades.get(audio) === fade) fades.delete(audio)
        resolve(done)
      },
    }
    const step = () => {
      const t = Math.min((performance.now() - start) / (PREVIEW_FADE * 1000), 1)
      audio.volume = from + (to - from) * t
      if (t < 1) fade.timer = setTimeout(step, 16)
      else fade.settle(true)
    }
    fades.set(audio, fade)
    fade.timer = setTimeout(step, 16)
  })
}

// Elements already set to loop, and those rewinding right now.
const looping = new WeakSet<HTMLAudioElement>()
const rewinding = new WeakSet<HTMLAudioElement>()

// Plays the preview over and over: just before it ends it fades out, goes
// back to the start and fades in again. Left alone while another fade (a
// swipe or a stop) is running, or once it's been paused.
function loopPreview(audio: HTMLAudioElement) {
  if (looping.has(audio)) return
  looping.add(audio)
  audio.addEventListener("timeupdate", () => {
    const left = audio.duration - audio.currentTime
    // timeupdate fires every ~250ms, so start the fade a little early.
    if (!(left <= PREVIEW_FADE + 0.3) || audio.paused) return
    if (rewinding.has(audio) || fades.has(audio)) return
    void rewind(audio)
  })
  // If it reaches the end anyway (a stalled tab), start it over too.
  audio.addEventListener("ended", () => {
    if (rewinding.has(audio) || fades.has(audio)) return
    void fadeIn(audio).catch(() => undefined)
  })
}

async function rewind(audio: HTMLAudioElement) {
  rewinding.add(audio)
  const done = await fadeAudio(audio, 0)
  rewinding.delete(audio)
  if (!done || audio.paused) return
  audio.currentTime = 0
  void fadeAudio(audio, PREVIEW_VOLUME)
}

// Starts `audio` silent and fades it up; it loops from then on. Not while the
// player has turned music off (sound-settings.ts): it stays paused.
export async function fadeIn(audio: HTMLAudioElement) {
  if (!soundOn("music")) return
  stopFade(audio)
  loopPreview(audio)
  audio.volume = 0
  await audio.play()
  void fadeAudio(audio, PREVIEW_VOLUME)
}

// Like fadeIn, but a source that won't load (an expired Deezer link) gets one
// more go from `refresh`, a fresh lookup told the link that failed; null from
// it gives up.
export async function fadeInFresh(
  audio: HTMLAudioElement,
  refresh: (failed: string) => Promise<string | null>
) {
  try {
    await fadeIn(audio)
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotSupportedError"))
      throw error
    const url = await refresh(audio.src).catch(() => null)
    if (!url || url === audio.src) throw error
    audio.src = url
    await fadeIn(audio)
  }
}

// Silent while the page is out of sight, like the rest of the game's sound:
// paused at once when hidden (fades can't be counted on to run there), then
// `resume`d when back. Leaving the page, or its back/forward cache, `leave`s
// it for good, so it doesn't come back blaring. Turning music off fades it
// out, and back on resumes it. Returns the cleanup.
export function silentWhileHidden(
  audio: () => HTMLAudioElement | null,
  resume: (audio: HTMLAudioElement) => void,
  leave: () => void
) {
  const hide = () => {
    const current = audio()
    if (!current) return
    stopFade(current)
    current.pause()
  }
  const visibility = () => {
    const current = audio()
    if (document.hidden) hide()
    else if (current?.paused) resume(current)
  }
  const pagehide = () => {
    leave()
    hide()
  }
  const musicChange = () => {
    const current = audio()
    if (!current) return
    if (!soundOn("music")) void fadeOut(current)
    else if (current.paused && !document.hidden) resume(current)
  }
  document.addEventListener("visibilitychange", visibility)
  addEventListener("pagehide", pagehide)
  const unlisten = onSoundChange(musicChange)
  return () => {
    document.removeEventListener("visibilitychange", visibility)
    removeEventListener("pagehide", pagehide)
    unlisten()
  }
}

// Waits until a fade-in started then is fully in at `end`, a
// performance.now() time; at once if that's already passed.
export function waitToFadeIn(end: number) {
  const left = end - PREVIEW_FADE * 1000 - performance.now()
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(left, 0)))
}

// Fades `audio` down, then pauses it; resolves once it's silent, or once
// another fade has taken over.
export async function fadeOut(audio: HTMLAudioElement) {
  if (audio.paused) return
  if (await fadeAudio(audio, 0)) audio.pause()
}

// Resolves a song's 30s preview: the stored Spotify one the card came with,
// else Deezer's (looked up server-side, since Deezer's API isn't open to
// browsers). `skip`: a link that wouldn't play, so the server doesn't send it
// back (a dead stored one gets Deezer's). Null without a Convex backend or a
// preview.
export function usePreviewUrl() {
  const convex = useConvex()
  return async (
    songId: string,
    stored: string | null = null,
    skip?: string
  ) => {
    if (stored && stored !== skip) return stored
    if (!convex) return null
    const { url } = await convex.action(
      api.playback.preview,
      skip ? { songId, skip } : { songId }
    )
    return url
  }
}

// Plays a song's preview on its own, fully faded in `by` seconds from now,
// unless the game's sound is off; looked up and loaded meanwhile. `autoplay`
// resolves once the song is heard, or once it won't be. Fades it out on
// `stop` or when the component unmounts. No song (an artist with none): silent.
export function useSongPreview(
  songId: string | null,
  stored: string | null = null
) {
  const previewUrl = usePreviewUrl()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // False once stopped, so a preview still loading doesn't start after.
  const wantedRef = useRef(false)
  // The one start per mount; later calls wait on it too.
  const startRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    const unhide = silentWhileHidden(
      () => audioRef.current,
      (audio) => {
        if (wantedRef.current) void fadeIn(audio).catch(() => undefined)
      },
      () => {
        wantedRef.current = false
      }
    )
    return () => {
      unhide()
      wantedRef.current = false
      if (audioRef.current) void fadeOut(audioRef.current)
      audioRef.current = null
    }
  }, [])

  async function start(by: number) {
    if (!songId) return
    wantedRef.current = true
    const end = performance.now() + by * 1000
    const url = await previewUrl(songId, stored).catch(() => null)
    if (!url || !wantedRef.current) return
    const next = new Audio(url)
    next.preload = "auto"
    audioRef.current = next
    await waitToFadeIn(end)
    // Hidden: it starts once back in sight.
    if (!wantedRef.current || document.hidden) return
    // Blocked by the browser's autoplay rules: stay silent. A link that won't
    // load is looked up afresh, unless stopped meanwhile.
    await fadeInFresh(next, (failed) =>
      previewUrl(songId, null, failed).then((fresh) =>
        wantedRef.current ? fresh : null
      )
    ).catch(() => undefined)
    // Stopped while it was starting: fade it straight back out.
    if (!wantedRef.current) void fadeOut(next)
  }

  function autoplay(by = PREVIEW_FADE) {
    startRef.current ??= start(by)
    return startRef.current
  }

  function stop() {
    wantedRef.current = false
    if (audioRef.current) void fadeOut(audioRef.current)
  }

  return { autoplay, stop }
}
