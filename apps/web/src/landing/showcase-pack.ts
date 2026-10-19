import type { GameSong } from "@workspace/ui/lib/game/theme"

export type ShowcaseCard = GameSong & {
  isNew: true
  // Its 30s Spotify preview.
  preview: string
  blurb: string
}

const spotifyImage = (id: string) => `https://i.scdn.co/image/${id}`

// Real catalog cards for the landing's pack, least rare first like a real pull.
// shortcut: copied from the catalog on 2026-10-20; refresh by hand if the
// catalog drops them or their art changes.
export const SHOWCASE: ReadonlyArray<ShowcaseCard> = [
  {
    id: "ms7ak5nf58x15a9n8agwxt1efx8g3km8",
    kind: "song",
    title: "King Of My Heart",
    artist: "Taylor Swift",
    imageUrl: spotifyImage("ab67616d0000b273da5d5aeeabacacc1263c0f4b"),
    streams: 388_592_948,
    rarity: "common",
    isNew: true,
    preview:
      "https://p.scdn.co/mp3-preview/0516a831776b659d81ca0ad0377cf9988285fa07",
    blurb:
      "Every card is a real song, rated by its real Spotify streams. 100M+ makes a common.",
  },
  {
    id: "ms7ehgxsb69c139swc8qapgfvx8g3k4g",
    kind: "song",
    title: "I'm On Fire",
    artist: "Bruce Springsteen",
    imageUrl: spotifyImage("ab67616d0000b273a43a6482e327d623bb0c0f77"),
    streams: 839_896_838,
    rarity: "rare",
    isNew: true,
    preview:
      "https://p.scdn.co/mp3-preview/e9bb2268bc574f78cb700ad364fa087fe3fd04bb",
    blurb:
      "400M+ streams: rare. Turn the sound on and every card you pull plays its song.",
  },
  {
    id: "ms78t6dvejcsjd4ghq6tqk21318g2er6",
    kind: "song",
    title: "Despacito - Remix",
    artist: "Luis Fonsi, Daddy Yankee, Justin Bieber",
    imageUrl: spotifyImage("ab67616d0000b273d8559d0280ffe2a2af6dacdf"),
    streams: 1_941_249_657,
    rarity: "epic",
    isNew: true,
    preview:
      "https://p.scdn.co/mp3-preview/e70482c7ad6c9806d90781418c5e578878d41b0e",
    blurb:
      "1B+ streams: epic. When a song climbs the charts, your card levels up with it.",
  },
  {
    id: "ms7596qrqwk4ftvtq751epydes8g3xc8",
    kind: "song",
    title: "Blinding Lights",
    artist: "The Weeknd",
    imageUrl: spotifyImage("ab67616d0000b273c464fabb4e51b72d657f779a"),
    streams: 5_631_276_067,
    rarity: "legendary",
    isNew: true,
    preview:
      "https://p.scdn.co/mp3-preview/51c08d92815cce4ac2de94a7335a430b81234624",
    blurb:
      "2B+ streams: legendary. Every pack builds up to its best card, always rare or better.",
  },
  {
    id: "mn7enav9n32s9javmsba5ddr0n8g2y69",
    kind: "artist",
    title: "Taylor Swift",
    artist: "Artist",
    imageUrl: spotifyImage("ab6761610000e5eb12184bdd29403de54cb9d9c7"),
    streams: 121_987_546_094,
    rarity: "legendary",
    isNew: true,
    preview:
      "https://p.scdn.co/mp3-preview/dba15da5409f3c808022cf927c0ff8581f717aa4",
    blurb:
      "Artist cards rate a whole career, wavy edge and all. One pack in 1,000 is a god pack: five legendaries.",
  },
]

// The pack's art, from legendary covers as in the game.
export const SHOWCASE_COVERS = [
  "ab67616d0000b273c464fabb4e51b72d657f779a",
  "ab67616d0000b27383e9b06ccd219248b5301264",
  "ab67616d0000b273a07ff4ebd6264e7c124c3bdd",
  "ab67616d0000b2738265a736a1eb838ad5a0b921",
].map(spotifyImage)
