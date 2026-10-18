import type { CssVars } from "@workspace/ui/lib/game/theme"
import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"

const FULL: CssVars = { "--fill": "1" }

// The free packs held: a pill of mini packs, gray until held, the next one filling with color
// from the bottom as it comes (`progress`, 0 to 1), with a badge under it (MAX, or the time
// left). `extra` more packs (bought ones) show as one more pack with a ×count on it. Styled in
// game.css.
function PackMeter({
  held,
  max,
  progress,
  badge,
  extra = 0,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  held: number
  max: number
  progress: number
  badge: React.ReactNode
  extra?: number
}) {
  return (
    <div
      data-slot="pack-meter"
      data-full={held >= max || undefined}
      className={cn(className)}
      {...props}
    >
      <div data-slot="pack-meter-track">
        {Array.from({ length: max }, (_, at) => {
          const fill: CssVars = {
            "--fill": String(at < held ? 1 : at === held ? progress : 0),
          }
          return (
            <span
              key={at}
              data-slot="pack-meter-pack"
              data-held={at < held || undefined}
              style={fill}
            />
          )
        })}
        {extra > 0 ? (
          <span data-slot="pack-meter-extra">
            <span data-slot="pack-meter-pack" data-held style={FULL} />
            <span data-slot="pack-meter-count">×{extra}</span>
          </span>
        ) : null}
        <span data-slot="pack-meter-badge">{badge}</span>
      </div>
    </div>
  )
}

export { PackMeter }
