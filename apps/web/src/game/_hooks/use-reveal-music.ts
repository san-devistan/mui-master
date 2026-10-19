import {
  fadeIn,
  fadeInFresh,
  fadeOut,
  PREVIEW_FADE,
  silentWhileHidden,
  usePreviewUrl,
  waitToFadeIn,
} from "@/game/_hooks/use-song-preview"
import { useEffect, useRef } from "react"

// A silent WAV: played inside the tap that opens the pack, so the browser
// lets the same audio element play later, when a card lands. A few samples
// long: WebKit won't decode an empty one.
const SILENCE =
  "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA"

// Plays each revealed card's preview while it's on show. On a swipe the
// last song fades out fully, then the next fades in. Silent for songs without
// a preview. `unlock` must run inside the tap that opens the pack.
export function useRevealMusic() {
  const previewUrl = usePreviewUrl()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // The latest request wins: a quick swipe skips songs still loading.
  const wantedRef = useRef<string | null>(null)
  // The song the audio element holds, once loaded into it.
  const loadedRef = useRef<string | null>(null)

  function current() {
    audioRef.current ??= new Audio()
    return audioRef.current
  }

  function stop() {
    wantedRef.current = null
    if (audioRef.current) void fadeOut(audioRef.current)
  }

  function unlock() {
    const audio = current()
    loadedRef.current = null
    audio.src = SILENCE
    void audio.play().catch(() => undefined)
  }

  // Fully in `by` seconds from now: once its card's reveal has played out.
  // `stored`: the card's own preview, played without a lookup.
  async function play(
    songId: string,
    by = PREVIEW_FADE,
    stored: string | null = null
  ) {
    wantedRef.current = songId
    const end = performance.now() + by * 1000
    const audio = current()
    // The last song fades out while the next is looked up; only once it's
    // silent does the next one start.
    const [url] = await Promise.all([
      previewUrl(songId, stored).catch(() => null),
      fadeOut(audio),
    ])
    // A later swipe took over, or this song has no preview: stay silent.
    if (wantedRef.current !== songId || !url) return
    audio.preload = "auto"
    audio.src = url
    loadedRef.current = songId
    // Loads while it waits.
    await waitToFadeIn(end)
    // Hidden: it starts once back in sight.
    if (wantedRef.current !== songId || document.hidden) return
    // A link that won't load is looked up afresh, unless swiped on meanwhile.
    await fadeInFresh(audio, (failed) =>
      previewUrl(songId, null, failed).then((fresh) =>
        wantedRef.current === songId ? fresh : null
      )
    ).catch(() => undefined)
    // Swiped on or stopped while it was starting: fade it straight back out.
    if (wantedRef.current !== songId) void fadeOut(audio)
  }

  useEffect(() => {
    const unhide = silentWhileHidden(
      () => audioRef.current,
      (audio) => {
        if (wantedRef.current && wantedRef.current === loadedRef.current)
          void fadeIn(audio).catch(() => undefined)
      },
      () => {
        wantedRef.current = null
      }
    )
    return () => {
      unhide()
      if (audioRef.current) void fadeOut(audioRef.current)
      audioRef.current = null
    }
  }, [])

  return { unlock, play, stop }
}
