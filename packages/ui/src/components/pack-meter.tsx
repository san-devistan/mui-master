import type { CssVars } from "@workspace/ui/lib/game/theme"
import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"

// The free packs held: a pill of mini packs, gray until held, the next one filling with color
// from the bottom as it comes (`progress`, 0 to 1), with a badge under it (MAX, or the time
// left). Styled in game.css.
function PackMeter({
  held,
  max,
  progress,
  badge,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  held: number
  max: number
  progress: number
  badge: React.ReactNode
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
        <span data-slot="pack-meter-badge">{badge}</span>
      </div>
    </div>
  )
}

export { PackMeter }
