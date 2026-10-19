// Run: node apps/web/src/landing/story.check.mjs
import { storyAt } from "./story.ts"

/** @type {(ok: unknown, what: string) => void} */
function check(ok, what) {
  if (!ok) throw new Error(`story: ${what}`)
}

check(storyAt(-2, 5).phase === "idle", "above the story, the pack waits")
check(storyAt(0, 5).phase === "idle", "the first chapter shows the pack")
check(storyAt(1, 5).phase === "cut", "the second chapter cuts it")
check(storyAt(1, 5).cut === 0.5, "half cut with its chapter centred")
check(storyAt(1.6, 5).phase === "open", "cut through, it opens")
check(storyAt(1.6, 5).index === 0, "on the first card")
check(storyAt(4, 5).index === 2, "a card per chapter")
check(storyAt(7, 5).index === 4, "the closing chapter keeps the last card")
check(storyAt(40, 5).index === 4, "and so does the page below")
check(storyAt(0.4, 5).phase === "idle", "scrolled back up, the pack is whole")
