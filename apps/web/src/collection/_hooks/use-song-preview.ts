import type { SongCard } from "@/collection/_lib/card-format"
import { useConvexAction } from "@convex-dev/react-query"
import { api } from "@workspace/backend/api"
import { useEffect, useRef, useState } from "react"

export type PreviewStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "unavailable"
  | "error"

type SongId = SongCard["id"]

export function useSongPreview(collectorKey: string) {
  const fetchPreview = useConvexAction(api.playback.preview)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const requestRef = useRef(0)
  const [status, setStatus] = useState<PreviewStatus>("idle")

  useEffect(
    () => () => {
      audioRef.current?.pause()
    },
    []
  )

  function getAudio() {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.addEventListener("ended", () => setStatus("paused"))
      audioRef.current = audio
    }
    return audioRef.current
  }

  async function start(audio: HTMLAudioElement) {
    try {
      await audio.play()
      setStatus("playing")
    } catch (error) {
      setStatus(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "paused"
          : "error"
      )
    }
  }

  async function play(songId: SongId) {
    const request = requestRef.current + 1
    requestRef.current = request
    const audio = getAudio()
    audio.pause()
    setStatus("loading")

    try {
      const { url } = await fetchPreview({ collectorKey, songId })
      if (request !== requestRef.current) {
        return
      }
      if (!url) {
        setStatus("unavailable")
        return
      }
      audio.src = url
      await start(audio)
    } catch {
      if (request === requestRef.current) {
        setStatus("error")
      }
    }
  }

  function toggle() {
    const audio = audioRef.current
    if (!audio?.src) {
      return
    }
    if (status === "playing") {
      audio.pause()
      setStatus("paused")
    } else {
      void start(audio)
    }
  }

  function stop() {
    requestRef.current += 1
    audioRef.current?.pause()
    setStatus("idle")
  }

  return { status, play, toggle, stop }
}
