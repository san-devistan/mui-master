import type { CssVars } from "@workspace/ui/lib/game/theme"

// Beams rising from all along the mouth, leaning out the further from its
// middle they start, each its own width, height and flicker.
const RAYS = Array.from({ length: 11 }, (_, ray) => {
  const across = (ray / 10 - 0.5) * 2
  const jitter = ((ray * 37) % 5) / 4 - 0.5
  const vars: CssVars = {
    "--ray-x": `${across * 0.85 + jitter * 0.1}`,
    "--ray-angle": `${across * 14 + jitter * 6}deg`,
    "--ray-width": `${34 + ((ray * 37) % 5) * 9}px`,
    "--ray-height": `${26 + ((ray * 29) % 7) * 3}%`,
    "--ray-hue": `${(ray * 47) % 360}deg`,
    "--ray-delay": `${((ray * 13) % 7) * -0.07}s`,
  }
  return { id: `ray-${String(ray)}`, vars }
})

// Star glints thrown up through the light, from across the mouth.
const GLINTS = Array.from({ length: 16 }, (_, glint) => {
  const vars: CssVars = {
    "--glint-x": `${((glint * 61) % 100) - 50}%`,
    "--glint-rise": `${100 + ((glint * 53) % 180)}px`,
    "--glint-size": `${10 + ((glint * 7) % 4) * 6}px`,
    "--glint-delay": `${0.05 + ((glint * 17) % 11) * 0.04}s`,
  }
  return { id: `glint-${String(glint)}`, vars }
})

// The flash of light out of an opened pack holding a legendary: soft rainbow
// beams up from its whole mouth, a white-hot glow along the cut, and glints
// thrown up through it, gone in about a second, before the pack drops away
// (opening-scene.ts holds it for that). Plays once on mount; remount it to
// replay. Styled in game.css.
function PackGlow() {
  return (
    <div data-slot="pack-glow" aria-hidden="true">
      <i data-slot="pack-glow-wash" />
      <span data-slot="pack-glow-rays">
        {RAYS.map((ray) => (
          <i key={ray.id} data-slot="pack-glow-ray" style={ray.vars} />
        ))}
      </span>
      <i data-slot="pack-glow-lip" />
      {GLINTS.map((glint) => (
        <i key={glint.id} data-slot="pack-glow-glint" style={glint.vars} />
      ))}
    </div>
  )
}

export { PackGlow }
