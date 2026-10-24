import type { GameSong } from "@workspace/ui/lib/game/theme"

export type ShowcaseCard = GameSong & {
  isNew: true
  // Its 30s Spotify preview (an artist's: their most played song's).
  preview: string
  blurb: string
}

const spotifyImage = (id: string) => `https://i.scdn.co/image/${id}`
const spotifyPreview = (id: string) => `https://p.scdn.co/mp3-preview/${id}`

// shortcut: real catalog cards copied from the dev deployment on 2026-10-20;
// refresh by hand if the catalog drops them or their art changes.

// The landing's pack: three cards, least rare first like a real pull.
export const SHOWCASE: ReadonlyArray<ShowcaseCard> = [
  {
    id: "ms747pyn9p7sw00vrqy205hfzd8g3vv9",
    kind: "song",
    title: "Papaoutai",
    artist: "Stromae",
    imageUrl: spotifyImage("ab67616d0000b2738a6bb98baff4c9b15f9972fc"),
    streams: 716_787_275,
    rarity: "rare",
    isNew: true,
    preview: spotifyPreview("7d2290b9e76b005ed08b362b747ab96d96911db5"),
    blurb:
      "Every card is a real song rated by its Spotify streams: 400M+ makes a rare.",
  },
  {
    id: "mn7b6wx6zytn1zwxxvtj587mfx8g3j92",
    kind: "artist",
    title: "BLACKPINK",
    artist: "Artist",
    imageUrl: spotifyImage("ab6761610000e5eb623538b7014238c54ceee056"),
    streams: 15_767_779_479,
    rarity: "epic",
    isNew: true,
    preview: spotifyPreview("29a60b8d3fe44fdab03a0921fe70a9ea4a972a59"),
    blurb:
      "Artist cards rate a whole career, wavy edge and all. 5B+ streams makes an epic artist.",
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
    preview: spotifyPreview("51c08d92815cce4ac2de94a7335a430b81234624"),
    blurb:
      "2B+ streams: legendary. Every pack builds up to its best card, always rare or better.",
  },
]

// The pack's art, from legendary covers as in the game.
export const SHOWCASE_COVERS = [
  "ab67616d0000b273c464fabb4e51b72d657f779a",
  "ab67616d0000b273755995e9ff2b1b0c753f5eb8",
  "ab67616d0000b27327ddd747545c0d0cfe7595fa",
  "ab67616d0000b27349d694203245f241a1bcaa72",
].map(spotifyImage)

// The cards behind the hero, two artists and two songs.
export const HERO_CARDS: ReadonlyArray<GameSong> = [
  {
    id: "mn7av407143t728x83n486dyn98g3md7",
    kind: "artist",
    title: "BTS",
    artist: "Artist",
    imageUrl: spotifyImage("ab6761610000e5ebf80ec63ea7a0ef0fba60957d"),
    streams: 50_650_188_486,
    rarity: "legendary",
  },
  {
    id: "mn70z9qv3bh8mq76vgge52a2p18g25h6",
    kind: "artist",
    title: "Shakira",
    artist: "Artist",
    imageUrl: spotifyImage("ab6761610000e5eb17f15f351cba70561ad8bcac"),
    streams: 27_824_205_863,
    rarity: "legendary",
  },
  {
    id: "ms740xppmx4mdnx0z5st6bar018g24ra",
    kind: "song",
    title: "Tití Me Preguntó",
    artist: "Bad Bunny",
    imageUrl: spotifyImage("ab67616d0000b27349d694203245f241a1bcaa72"),
    streams: 2_405_692_208,
    rarity: "legendary",
  },
  {
    id: "ms75kp9z5dgndx5757v0cwscvx8g3nxw",
    kind: "song",
    title: "DESPECHÁ",
    artist: "ROSALÍA",
    imageUrl: spotifyImage("ab67616d0000b273938660520f09a1bae2ed4699"),
    streams: 1_364_240_142,
    rarity: "epic",
  },
  {
    id: "ms74g79d5e3a4q6qcjt3h64dy18g3grj",
    kind: "song",
    title: "夜に駆ける",
    artist: "YOASOBI",
    imageUrl: spotifyImage("ab67616d0000b27339917845c74c9e64320fbed9"),
    streams: 780_590_077,
    rarity: "rare",
  },
  {
    id: "mn75zn62s35dtzpphq6cj5ae6d8g3df0",
    kind: "artist",
    title: "Burna Boy",
    artist: "Artist",
    imageUrl: spotifyImage("ab6761610000e5ebb4e44d0f4e3e47af2cf06f3f"),
    streams: 6_405_124_515,
    rarity: "epic",
  },
  {
    id: "ms707f9g9sqzaytv972bd0wyed8g25at",
    kind: "song",
    title: "Ella Baila Sola",
    artist: "Eslabon Armado, Peso Pluma",
    imageUrl: spotifyImage("ab67616d0000b2732071a0c79802d9375a53bfef"),
    streams: 1_640_891_329,
    rarity: "epic",
  },
]

// More cards for the feature list at the foot of the page, none of them seen above.
export const JOIN_CARDS: ReadonlyArray<GameSong> = [
  {
    id: "ms7a9amgx01mhxsq14cymjj8098g299q",
    kind: "song",
    title: "BIRDS OF A FEATHER",
    artist: "Billie Eilish",
    imageUrl: spotifyImage("ab67616d0000b27371d62ea7ea8a5be92d3c1f62"),
    streams: 4_037_340_288,
    rarity: "legendary",
  },
  {
    id: "mn76r47czpqqnhmnx5m8b4s48d8g3znx",
    kind: "artist",
    title: "Tame Impala",
    artist: "Artist",
    imageUrl: spotifyImage("ab6761610000e5ebe412a782245eb20d9626c601"),
    streams: 12_415_010_024,
    rarity: "epic",
  },
]
