import type { GameSong } from "@workspace/ui/lib/game/theme"

// Snapshot from Convex dev songs, 2026-10-09. Replace with backend queries
// when the game loop is built.
export const SONGS = [
  {
    id: "k5764jmczhfvq0yg8wmsg6qw5s8fp7t3",
    title: "Beautiful Things",
    artist: "Benson Boone",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b273f85058b7e234523d2d2ef834",
    streams: 3188699803,
    rank: 48,
    rarity: "legendary",
  },
  {
    id: "k57615descknafnqkxj5p3cvgd8fq6kv",
    title: "Come As You Are",
    artist: "Nirvana",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2739aa37e5baca62ca6cc98d056",
    streams: 2191656413,
    rank: 199,
    rarity: "legendary",
  },
  {
    id: "k57dra7t9383msec1pq5jsb1w58fpvnk",
    title: "Feel Good Inc.",
    artist: "Gorillaz, De La Soul",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b27322c1b2b58a23408632527ab7",
    streams: 2573698443,
    rank: 105,
    rarity: "legendary",
  },
  {
    id: "k572p1deh9vqtshnn7h3x6hg4h8fqr7g",
    title: "7 rings",
    artist: "Ariana Grande",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b27356ac7b86e090f307e218e9c8",
    streams: 2940301935,
    rank: 67,
    rarity: "legendary",
  },
  {
    id: "k5785d8hacxeza2vdfrwdy06vx8fqy2b",
    title: "Wolves",
    artist: "Selena Gomez, Marshmello",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b273307910d4242c0d6b1fedf955",
    streams: 1582469672,
    rank: 435,
    rarity: "epic",
  },
  {
    id: "k57aqs8kd1y2cfbyz6vyhcsprd8fqqgk",
    title: "Taki Taki",
    artist: "DJ Snake, Selena Gomez, Ozuna, Cardi B",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b273e105c410a7b390c61a58cbf8",
    streams: 1884866333,
    rank: 298,
    rarity: "epic",
  },
  {
    id: "k57101j55aq66tbxex92qynak58fqqr2",
    title: "Electric Love",
    artist: "BØRNS",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b273cc2cf912462d8ae4ef856434",
    streams: 1427929649,
    rank: 546,
    rarity: "epic",
  },
  {
    id: "k57e7ez2vzyaaxebv0hwmq9rnx8fpysa",
    title: "I Hate Everything About You",
    artist: "Three Days Grace",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2735d4bd2c345c95e847b586403",
    streams: 1358112211,
    rank: 602,
    rarity: "epic",
  },
  {
    id: "k57dvpy05znqed5gztebmw9zg98fv9xn",
    title: "You Don't Know Me",
    artist: "Jax Jones, RAYE",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2731d883d3f10af481faa3c7e04",
    streams: 758363980,
    rank: 1594,
    rarity: "rare",
  },
  {
    id: "k57b50vbwbs50hzt0t3j8p6cf58fv1rj",
    title: "Say It",
    artist: "Tory Lanez",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2739f7ce2227875fd3d645fb5d6",
    streams: 786883367,
    rank: 1509,
    rarity: "rare",
  },
  {
    id: "k573sfzw27m4xcep2c0kdt1hhh8fvt50",
    title: "White Mustang",
    artist: "Lana Del Rey",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b27395e2fd1accb339fa14878190",
    streams: 482263693,
    rank: 2894,
    rarity: "rare",
  },
  {
    id: "k5707cm4fvfzr9yek1bxe7d7as8fv6sf",
    title: "Death of a Bachelor",
    artist: "Panic! At The Disco",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b27323152d9337d6c57b116ed13a",
    streams: 478194653,
    rank: 2925,
    rarity: "rare",
  },
  {
    id: "k57cy6kadq6jsaq1txwv1q5d658ftcgz",
    title: "Keep Ya Head Up",
    artist: "2Pac",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2737f6f6c9e4b492a3d7e910d82",
    streams: 411214078,
    rank: 3525,
    rarity: "rare",
  },
  {
    id: "k57ctf8nd7dnv4dymhy685z15x8fvvk6",
    title: "1999",
    artist: "Charli xcx, Troye Sivan",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b273a4ad09abe4e62f88e8238471",
    streams: 273843188,
    rank: 5592,
    rarity: "common",
  },
  {
    id: "k575pyvrwb2yd4h886c6ksgatn8fvm41",
    title: "Movin' Out (Anthony's Song)",
    artist: "Billy Joel",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2736ce61113662ecf693b605ee5",
    streams: 243992168,
    rank: 6297,
    rarity: "common",
  },
  {
    id: "k57b4g86f178jjnyc6j5qp0ps58fv6wp",
    title: "Heavy Eyes",
    artist: "Zach Bryan",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2735d2676e12a38ad50bc3ac85b",
    streams: 214488845,
    rank: 7238,
    rarity: "common",
  },
  {
    id: "k577qpjq0ayeva8q29xqkqqre98fv6cp",
    title: "Da Funk",
    artist: "Daft Punk",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b27387aa91b6ba6b4fded7bf3293",
    streams: 137082973,
    rank: 11244,
    rarity: "common",
  },
  {
    id: "k57fcbv7zr8b2w6dpjbc2fj6258ftq77",
    title: "Kill Rock 'n Roll",
    artist: "System Of A Down",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b273f5e7b2e5adaa87430a3eccff",
    streams: 110772812,
    rank: 13588,
    rarity: "common",
  },
  {
    id: "k57dn8rnj19d4746fwjzy0k2k58fvf1e",
    title: "Oprah's Bank Account",
    artist: "Lil Yachty, DaBaby, Drake",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2735ee839f6415e0d02fc4f2b49",
    streams: 244358274,
    rank: 6273,
    rarity: "common",
  },
  {
    id: "k579aktzkx8r4dhwthztfejmz18fpp9r",
    title: "Rocket Man (I Think It's Going To Be A Long, Long Time)",
    artist: "Elton John",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b2733009007708ab5134936a58b3",
    streams: 1594993356,
    rank: 428,
    rarity: "epic",
  },
  {
    id: "k575xete6fzrvktbtdmjrpaaa58fvm2g",
    title: "We Don't Talk About Bruno",
    artist:
      "Carolina Gaitán - La Gaita, Mauro Castillo, Adassa, Rhenzy Feliz, Diane Guerrero, Stephanie Beatriz, Encanto - Cast",
    imageUrl:
      "https://i.scdn.co/image/ab67616d0000b273e1ac646ed6f25125e2a77229",
    streams: 642793004,
    rank: 2013,
    rarity: "rare",
  },
] as const satisfies ReadonlyArray<GameSong>

export type DemoSong = (typeof SONGS)[number]

export const COLLECTION = SONGS.map((song, index) => ({
  ...song,
  copies: index % 5 === 1 ? 2 : 1,
  pulledOn: `2026-10-${String(9 - (index % 7)).padStart(2, "0")}`,
}))

export type CollectedSong = (typeof COLLECTION)[number]

export const PACK_COVERS = SONGS.slice(0, 4).map((song) => song.imageUrl)

export const DEMO_PACK = [
  { ...SONGS[16], isNew: false },
  { ...SONGS[13], isNew: true },
  { ...SONGS[9], isNew: true },
  { ...SONGS[5], isNew: true },
  { ...SONGS[0], isNew: false },
]

export const PLAYER = {
  name: "Léo",
  level: 7,
  owned: COLLECTION.length,
  total: 14799,
  packs: 38,
  streak: "7d",
}
