import type { Floater } from "@/landing/floating-cards"
import { HERO_CARDS } from "@/landing/showcase-pack"

// Real cards framing the hero's title from behind, each at its own depth and
// tilt: the parallax layers, the nearer ones rising faster as the page
// scrolls. The rarest hold the clear corners, whole on a phone; the last three
// sit right behind the words (on desktop, Bad Bunny's song swaps with Burna
// Boy, and ROSALÍA's with Shakira). A phone shows five, bigger: the corners
// (ROSALÍA's in Shakira's place, YOASOBI's and Bad Bunny's along the bottom)
// and Ella Baila Sola. The sign-in page sets its form among the same cards.
// Fixed so server and client agree.
export const HERO_FLOATERS: ReadonlyArray<Floater> = HERO_CARDS.map(
  (card, index) => ({
    card,
    place: [
      "left-5 top-24 w-34 sm:left-[2%] sm:w-40 lg:left-[8%] lg:top-[16%] lg:w-52 -rotate-12",
      "hidden sm:block sm:top-24 sm:right-[3%] sm:w-40 lg:top-auto lg:bottom-[2%] lg:right-[15%] lg:w-52 rotate-[9deg] lg:-rotate-[10deg]",
      "right-5 top-[calc(100dvh-18rem)] w-34 sm:top-auto sm:bottom-[4%] sm:right-auto sm:left-[9%] sm:w-40 lg:left-[31%] lg:top-[19%] lg:bottom-auto lg:w-48 -rotate-[10deg] sm:rotate-[7deg] lg:-rotate-[14deg]",
      "right-5 top-24 w-34 sm:top-auto sm:bottom-[2%] sm:right-[8%] sm:w-40 lg:top-[17%] lg:bottom-auto lg:right-[9%] lg:w-48 rotate-[9deg] sm:-rotate-[10deg] lg:rotate-[9deg]",
      "left-5 top-[calc(100dvh-18rem)] w-34 sm:left-[25%] sm:top-[30%] sm:w-44 lg:left-auto lg:right-[30%] lg:top-[45%] lg:w-52 rotate-[7deg] sm:-rotate-[17deg] lg:rotate-[15deg]",
      "hidden sm:block sm:right-[24%] sm:top-[39%] sm:w-44 lg:right-auto lg:left-[17%] lg:top-auto lg:bottom-[3%] lg:w-48 rotate-[15deg] lg:rotate-[7deg]",
      "left-[calc(50%-4.5rem)] top-[40%] w-36 sm:left-[42%] sm:top-[50%] sm:w-36 lg:left-[45%] lg:top-[46%] lg:w-40 -rotate-[5deg]",
    ][index],
    depth: [0.55, 0.2, 0.35, 0.75, 0.42, 0.26, 0.5][index] ?? 0.3,
  })
)
