import type { GameCard } from "@/game/_lib/cards"
import { sharePicture } from "@/game/_lib/share"
import { Button } from "@workspace/ui/components/button"
import { ShareIcon } from "lucide-react"
import type { ReactNode } from "react"

// Brand marks from Simple Icons (CC0), 24px grid.
const SERVICES = [
  {
    key: "spotify",
    label: "Spotify",
    path: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
    href: (card: GameCard) => card.spotifyUrl,
  },
  {
    key: "deezer",
    label: "Deezer",
    path: "M.693 10.024c.381 0 .693-1.256.693-2.807 0-1.55-.312-2.807-.693-2.807C.312 4.41 0 5.666 0 7.217s.312 2.808.693 2.808ZM21.038 1.56c-.364 0-.684.805-.91 2.096C19.765 1.446 19.184 0 18.526 0c-.78 0-1.464 2.036-1.784 5-.312-2.158-.788-3.536-1.325-3.536-.745 0-1.386 2.704-1.62 6.472-.442-1.932-1.083-3.145-1.793-3.145s-1.35 1.213-1.793 3.145c-.242-3.76-.874-6.463-1.628-6.463-.537 0-1.013 1.378-1.325 3.535C6.938 2.036 6.262 0 5.474 0c-.658 0-1.247 1.447-1.602 3.665-.217-1.291-.546-2.105-.91-2.105-.675 0-1.221 2.807-1.221 6.272 0 3.466.546 6.273 1.221 6.273.277 0 .537-.476.736-1.273.32 2.928.996 4.938 1.776 4.938.606 0 1.143-1.204 1.507-3.11.251 3.622.875 6.195 1.602 6.195.46 0 .875-1.023 1.187-2.677C10.142 21.6 11 24 12.004 24c1.005 0 1.863-2.4 2.235-5.822.312 1.654.727 2.677 1.186 2.677.728 0 1.352-2.573 1.603-6.195.364 1.906.9 3.11 1.507 3.11.78 0 1.455-2.01 1.775-4.938.208.797.46 1.273.737 1.273.675 0 1.22-2.807 1.22-6.273-.008-3.457-.553-6.272-1.23-6.272ZM23.307 10.024c.381 0 .693-1.256.693-2.807 0-1.55-.312-2.807-.693-2.807-.381 0-.693 1.256-.693 2.807s.312 2.808.693 2.808Z",
    href: (card: GameCard) => card.deezerUrl,
  },
] as const

// The song or artist on each streaming service it's on, opened in a new tab,
// with `between` set between the first and the second.
export function ListenLinks({
  song,
  between,
}: {
  song: GameCard
  between?: ReactNode
}) {
  const [first, ...rest] = SERVICES.map(({ key, label, path, href }) => {
    const url = href(song)
    return url ? (
      <Button
        key={key}
        variant="game"
        size="icon-game"
        nativeButton={false}
        aria-label={`Open on ${label}`}
        render={(props) => (
          <a {...props} href={url} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={path} fill="currentColor" stroke="none" />
            </svg>
          </a>
        )}
      />
    ) : null
  })
  return (
    <>
      {first}
      {between}
      {rest}
    </>
  )
}

// The showcase's row: the streaming links, and the share button between them.
export function ListenRow({
  song,
  picture,
}: {
  song: GameCard
  picture: () => Blob | null
}) {
  return (
    <div className="gap-3 flex items-center justify-center">
      <ListenLinks
        song={song}
        between={<ShareCard song={song} picture={picture} />}
      />
    </div>
  )
}

// Shares a picture of the card through the device's share sheet, or saves it
// where there's none. `picture`: the card as a PNG, null before it's drawn.
export function ShareCard({
  song,
  picture,
}: {
  song: GameCard
  picture: () => Blob | null
}) {
  function share() {
    const blob = picture()
    if (!blob) return
    const text =
      song.kind === "artist" ? song.title : `${song.title} by ${song.artist}`
    void sharePicture(blob, song.title, text)
  }

  return (
    <Button
      variant="game"
      size="icon-game"
      aria-label="Share this card"
      onClick={share}
    >
      <ShareIcon aria-hidden="true" />
    </Button>
  )
}
