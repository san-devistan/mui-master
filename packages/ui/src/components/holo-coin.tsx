import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"

// The game currency's coin: a holo-foil disc with an H, sized by font-size.
function HoloCoin({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="holo-coin"
      aria-hidden="true"
      className={cn("game-holo-coin", className)}
      {...props}
    >
      H
    </span>
  )
}

export { HoloCoin }
