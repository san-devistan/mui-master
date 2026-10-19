// The landing's pack, opened by scrolling, one chapter per screen: the waiting
// pack, its cut, a chapter per card, then the pile swiped away.
export type Story = {
  phase: "idle" | "cut" | "open"
  // How far along the seam the cut has run, 0..1.
  cut: number
  // The card on top of the pile.
  index: number
}

// The cut runs from halfway through the waiting pack's chapter to halfway
// through its own, so it's half done with its chapter centred on screen.
const CUT_FROM = 0.5
const CUT_TO = 1.5
const FIRST_CARD = 2

// `chapter`: chapters scrolled, 0 with the story's top at the top of the screen.
export function storyAt(chapter: number, cards: number): Story {
  if (chapter < CUT_FROM) return { phase: "idle", cut: 0, index: 0 }
  if (chapter < CUT_TO) {
    const cut = (chapter - CUT_FROM) / (CUT_TO - CUT_FROM)
    return { phase: "cut", cut, index: 0 }
  }
  // The last card stays on show through the closing chapter.
  const index = Math.min(Math.max(Math.round(chapter) - FIRST_CARD, 0), cards - 1)
  return { phase: "open", cut: 1, index }
}
